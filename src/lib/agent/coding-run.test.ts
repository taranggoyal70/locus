import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  assertCandidateIntegrity,
  buildDeterministicDiff,
  freezeCandidate,
} from "@/lib/agent/candidate";
import { AGENT_MAX_NUDGES, AGENT_MAX_STEPS, runCodingTask } from "@/lib/agent/coding-agent";
import { createCloudflareAgentModel } from "@/lib/agent/provider";
import { buildProposalPatch } from "@/lib/agent/proposal-patch";
import { RunBudgetExceededError } from "@/lib/agent/run-budget";
import { verifyFrozenCandidate } from "@/lib/agent/verification";
import { WorkspaceController, type AgentWorkspace } from "@/lib/agent/workspace";
import { AgentSlice, buildAgentPrompt } from "@/lib/agent/workspace-tools";

// A whole Run with nothing faked but the model's replies and the sandbox host:
// the real provider builds the request, the real tools edit a real git checkout,
// and the proposal is verified in a second checkout and applied as a patch.

const BASE: Record<string, string> = {
  "package.json": JSON.stringify({ scripts: { test: "node check.js" } }),
  "check.js":
    'require("node:assert").strictEqual(require("./src/price.js").format(5), "$5.00");\n',
  "src/price.js": 'exports.format = (value) => "£" + value.toFixed(2);\n',
};

const directories: string[] = [];
let revision = "";

function checkout(): string {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), "locus-run-")));
  directories.push(directory);
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: directory, stdio: "pipe", encoding: "utf8" });
  git("init", "-q");
  git("config", "core.autocrlf", "false");
  for (const [path, content] of Object.entries(BASE)) {
    mkdirSync(dirname(join(directory, path)), { recursive: true });
    writeFileSync(join(directory, path), content);
  }
  git("add", "-A");
  git("-c", "user.name=t", "-c", "user.email=t@example.test", "commit", "-qm", "base");
  revision = git("rev-parse", "HEAD").trim();
  return directory;
}

function localWorkspace(directory: string): AgentWorkspace {
  return {
    id: directory,
    description: "local checkout",
    run: async ({ command, env }) => {
      const result = spawnSync("sh", ["-c", command], {
        cwd: directory,
        env: { ...process.env, ...env },
        encoding: "utf8",
      });
      return { exitCode: result.status ?? 1, stdout: result.stdout, stderr: result.stderr };
    },
    writeFile: async ({ path, content }) => writeFileSync(resolve(directory, path), content),
    lockNetwork: async () => {},
    stop: async () => {},
  };
}

type Reply = { text?: string; calls?: Array<[tool: string, input: unknown]> };
type SentRequest = {
  response_format?: unknown;
  tools?: Array<{ function: { name: string } }>;
  messages: Array<{ role: string; content: unknown }>;
};

const requests: SentRequest[] = [];
let tokensPerStep = 100;

/** Answers each provider request in turn; the last reply repeats. */
function modelReplies(replies: Reply[]): void {
  vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
    const reply = replies[Math.min(requests.length, replies.length - 1)];
    requests.push(JSON.parse(String(init.body)) as SentRequest);
    return Response.json({
      id: "r",
      created: 0,
      model: "m",
      choices: [{
        index: 0,
        finish_reason: reply.calls ? "tool_calls" : "stop",
        message: {
          role: "assistant",
          content: reply.text ?? null,
          tool_calls: reply.calls?.map(([name, input], index) => ({
            id: `call-${requests.length}-${index}`,
            type: "function",
            function: { name, arguments: JSON.stringify(input) },
          })),
        },
      }],
      usage: {
        prompt_tokens: tokensPerStep - 10,
        completion_tokens: 10,
        total_tokens: tokensPerStep,
      },
    });
  });
}

async function run(tokenBudgetTokens = 100_000) {
  const controller = new WorkspaceController(
    localWorkspace(checkout()),
    new AgentSlice({ included: ["src/price.js"], excluded: ["package.json", "check.js"] }),
  );
  const checks = await controller.detectChecks();
  await controller.lockNetwork();
  const steps: number[] = [];
  const result = await runCodingTask({
    prompt: buildAgentPrompt({
      task: "Show prices in dollars",
      acceptanceCriteria: [],
      reason: "price matched",
      baselineTokens: 100,
      included: ["src/price.js"],
      excluded: ["package.json", "check.js"],
      checks,
      maxSteps: AGENT_MAX_STEPS,
    }),
    controller,
    baselineContextTokens: 100,
    includedContextTokens: 10,
    model: createCloudflareAgentModel({ accountId: "a".repeat(32), apiToken: "test" }),
    tokenBudgetTokens,
    onStepStart: ({ stepNumber }) => { steps.push(stepNumber); },
  });
  return { controller, result, steps, checks };
}

const edit: [string, unknown] = ["replace_text", {
  path: "src/price.js",
  before: '"£" + value',
  after: '"$" + value',
}];
const check: [string, unknown] = ["run_checks", { command: "npm test" }];
const submit: [string, unknown] = ["submit_proposal", {
  summary: "Prices use dollars.",
  risks: ["Other currencies are unchanged."],
}];

beforeEach(() => {
  requests.length = 0;
  tokensPerStep = 100;
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("a whole coding Run", { timeout: 60_000 }, () => {
  it("edits, checks and submits a change that verifies and applies elsewhere", async () => {
    modelReplies([
      { calls: [["read_file", { path: "src/price.js" }]] },
      { calls: [edit] },
      { calls: [check] },
      { calls: [submit] },
    ]);

    const { controller, result, checks } = await run();

    expect(checks).toEqual(["npm test"]);
    expect(requests).toHaveLength(4);
    expect(result.output).toEqual({
      summary: "Prices use dollars.",
      risks: ["Other currencies are unchanged."],
    });

    const files = await controller.changeSet();
    const candidate = freezeCandidate({ baseSha: revision, changes: files });
    const base = new Map(Object.entries(BASE));
    const diff = buildDeterministicDiff(base, candidate);
    assertCandidateIntegrity({ base, diff, candidate });

    const isolated = await verifyFrozenCandidate({
      workspace: localWorkspace(checkout()),
      candidate,
      commands: result.verification.map((item) => item.command),
      networkIsLocked: true,
    });
    expect(isolated.checks.map((item) => item.exitCode)).toEqual([0]);

    const patch = buildProposalPatch({
      runId: "0123abcd-0000-4000-8000-000000000001",
      proposalHash: "b".repeat(64),
      reviewed: true,
      changeSet: JSON.stringify({
        version: 2,
        baseCommitSha: candidate.baseSha,
        candidateSha256: candidate.candidateSha256,
        files,
      }),
      diff,
    });
    const target = checkout();
    execFileSync("git", ["apply", "--index", "-"], { cwd: target, input: patch.content });
    expect(execFileSync("npm", ["test"], { cwd: target, stdio: "pipe" })).toBeDefined();
  });

  it("never offers a final-answer format beside the tools", async () => {
    modelReplies([{ calls: [edit] }, { calls: [check] }, { calls: [submit] }]);

    await run();

    for (const request of requests) {
      expect(request.response_format).toBeUndefined();
      expect(request.tools?.map((item) => item.function.name)).toContain("submit_proposal");
    }
  });

  // The first live Run ended this way: one step, no tool calls, a summary.
  it("sends a model that answers before working back to work", async () => {
    modelReplies([
      { text: "I changed the price format." },
      { calls: [edit, check] },
      { calls: [check] },
      { calls: [submit] },
    ]);

    const { controller, result, steps } = await run();

    const reminder = requests[1].messages.at(-1);
    expect(reminder?.role).toBe("user");
    expect(JSON.stringify(reminder?.content)).toContain("No repository file has changed");
    expect(result.output.summary).toBe("Prices use dollars.");
    expect(await controller.changeSet()).toHaveLength(1);
    expect(steps).toEqual([0, 1, 2, 3]);
    expect(result.tokenLedger.totalTokens).toBe(400);
  });

  it("stops after bounded reminders when the model will not work", async () => {
    modelReplies([{ text: "All done." }]);

    const { controller, result } = await run();

    expect(requests).toHaveLength(1 + AGENT_MAX_NUDGES);
    expect(await controller.changeSet()).toEqual([]);
    expect(result.verification).toEqual([]);
  });

  it("refuses a submission until the change exists and its checks pass", async () => {
    modelReplies([
      { calls: [submit] },
      { calls: [check] },
      { calls: [edit] },
      { calls: [submit] },
      { calls: [check] },
      { calls: [submit] },
    ]);

    const { result } = await run();

    const answers = JSON.stringify(requests.at(-1)?.messages);
    expect(answers).toContain("No verification command has run");
    expect(answers).toContain("These checks last failed: npm test");
    expect(requests).toHaveLength(6);
    expect(result.output.summary).toBe("Prices use dollars.");
  });

  it("accepts finished work whose model closes in text", async () => {
    modelReplies([{ calls: [edit] }, { calls: [check] }, { text: "Prices now use dollars." }]);

    const { result } = await run();

    expect(requests).toHaveLength(3);
    expect(result.output).toEqual({
      summary: "Prices now use dollars.",
      risks: ["The Agent did not submit a list of remaining risks."],
    });
  });

  it("counts reminders against the one step limit", async () => {
    modelReplies([{ text: "Done." }, { calls: [["list_files", {}]] }]);

    await run();

    expect(requests).toHaveLength(AGENT_MAX_STEPS);
    expect(requests.at(-1)?.tools?.map((item) => item.function.name)).toEqual(["submit_proposal"]);
  });

  it("counts reminders against the one token budget", async () => {
    tokensPerStep = 9_000;
    modelReplies([{ text: "Done." }]);

    await expect(run(10_000)).rejects.toBeInstanceOf(RunBudgetExceededError);
    expect(requests).toHaveLength(1);
  });

  it("refuses a check the repository does not have, so it is never evidence", async () => {
    modelReplies([
      { calls: [edit] },
      { calls: [["run_checks", { command: "npm run lint" }]] },
      { calls: [check] },
      { calls: [submit] },
    ]);

    const { result } = await run();

    expect(JSON.stringify(requests.at(-1)?.messages)).toContain("Available: npm test");
    expect(result.verification.map((item) => item.command)).toEqual(["npm test"]);
  });

  it("writes replacement text literally", async () => {
    modelReplies([
      { calls: [["replace_text", {
        path: "src/price.js",
        before: '"£" + value',
        after: '"$&$1$$" + value',
      }]] },
      { text: "Done." },
    ]);

    const { controller } = await run();

    expect((await controller.changeSet())[0].content).toBe(
      'exports.format = (value) => "$&$1$$" + value.toFixed(2);\n',
    );
  });
});

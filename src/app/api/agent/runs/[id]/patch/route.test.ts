import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@clerk/nextjs/server", () => ({ auth: authMock }));

import { GET } from "@/app/api/agent/runs/[id]/patch/route";
import { buildDeterministicDiff, freezeCandidate } from "@/lib/agent/candidate";
import { decideRunProposal, publishRunProposal } from "@/lib/agent/run-store";
import { setupTestDatabase } from "@/test/database";
import { seedRun, seedTask } from "@/test/fixtures";

const database = setupTestDatabase();
const OWNER = "user_owner";
const BASE_SHA = "c".repeat(40);
const CRITERION = "The redirect keeps its query string";
const BASE: Record<string, string> = {
  "src/login.ts": "export const next = () => \"/\";\nexport const a = 1;\n",
  "src/old.ts": "export const old = true;\n",
};
const CHANGES = [
  { path: "src/login.ts", content: "export const next = (q: string) => `/?${q}`;\nexport const a = 1;\n" },
  { path: "src/new.ts", content: "export const added = true;\n" },
  { path: "src/old.ts", content: null },
];

let runId = "";
let proposalHash = "";
const directories: string[] = [];

function get(id = runId) {
  return GET(new Request(`http://localhost/api/agent/runs/${id}/patch`), { params: Promise.resolve({ id }) });
}

function decide(decision: "accepted" | "rejected") {
  return decideRunProposal({
    runId,
    userId: OWNER,
    proposalHash,
    decision,
    criteria: [{ criterion: CRITERION, satisfied: decision === "accepted" }],
    note: null,
  });
}

async function publish(overrides: { diff?: string; baseRevision?: string } = {}) {
  const candidate = freezeCandidate({ baseSha: BASE_SHA, changes: CHANGES });
  const taskId = await seedTask(database(), OWNER, { acceptance_criteria: [CRITERION] });
  runId = await seedRun(database(), OWNER, { task_id: taskId, status: "executing" });
  proposalHash = await publishRunProposal({
    runId,
    userId: OWNER,
    baseRevision: overrides.baseRevision ?? BASE_SHA,
    changeSetContent: JSON.stringify({
      version: 2, baseCommitSha: BASE_SHA, candidateSha256: candidate.candidateSha256, files: CHANGES,
    }),
    diff: overrides.diff ?? buildDeterministicDiff(new Map(Object.entries(BASE)), candidate),
    summary: "Kept the query string.",
    toolDetail: {},
    verifyDetail: { checks: [{ command: "pnpm test", exitCode: 0, output: "exit 0" }] },
    includedContextTokens: 1,
    inputTokens: 1,
    cachedInputTokens: 0,
    outputTokens: 1,
    widenedFiles: [],
    excludedFiles: [],
  });
}

beforeEach(async () => {
  authMock.mockResolvedValue({ userId: OWNER });
  await publish();
});

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("taking an accepted proposal out of Locus", () => {
  it("goes from a published proposal, through Review, to the exact change in a checkout", async () => {
    await decide("accepted");

    const response = await get();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toMatch(/^attachment; filename="locus-[0-9a-f]{8}\.patch"$/);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    const patch = await response.text();
    expect(patch).toContain(`Locus proposal ${proposalHash}`);
    expect(patch).toContain("Review: accepted");

    const directory = mkdtempSync(join(tmpdir(), "locus-route-"));
    directories.push(directory);
    for (const [path, content] of Object.entries(BASE)) {
      mkdirSync(dirname(join(directory, path)), { recursive: true });
      writeFileSync(join(directory, path), content);
    }
    execFileSync("git", ["init", "-q"], { cwd: directory });
    execFileSync("git", ["apply", "-"], { cwd: directory, input: patch });
    expect(readFileSync(join(directory, "src/login.ts"), "utf8")).toBe(CHANGES[0].content);
    expect(readFileSync(join(directory, "src/new.ts"), "utf8")).toBe(CHANGES[1].content);
    expect(() => readFileSync(join(directory, "src/old.ts"))).toThrow();
  });

  it("lets a reviewer try the proposal before deciding, and says it is not reviewed", async () => {
    const response = await get();

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Review: pending");
  });

  it("does not change the Run", async () => {
    const before = await database().selectFrom("agent_runs").selectAll().where("id", "=", runId).executeTakeFirst();
    await get();
    expect(await database().selectFrom("agent_runs").selectAll().where("id", "=", runId).executeTakeFirst()).toEqual(before);
  });
});

describe("refusing a patch", () => {
  it("requires sign-in", async () => {
    authMock.mockResolvedValue({ userId: null });
    expect((await get()).status).toBe(401);
  });

  it("does not reveal another account's Run", async () => {
    authMock.mockResolvedValue({ userId: "user_stranger" });
    expect((await get()).status).toBe(404);
  });

  it.each(["not-a-run", "../../x"])("rejects a malformed identifier: %s", async (id) => {
    expect((await get(id)).status).toBe(400);
  });

  it("has nothing for a rejected proposal", async () => {
    await decide("rejected");
    expect((await get()).status).toBe(409);
  });

  it("has nothing for a Run that published no proposal", async () => {
    expect((await get(await seedRun(database(), OWNER, { status: "failed" }))).status).toBe(409);
  });

  it.each([
    ["a diff that does not describe the change set", { diff: "diff --git a/x b/x\n--- a/x\n+++ b/x\n@@ -1,1 +1,1 @@\n-a\n+b\n" }],
    ["a base that disagrees with the change set", { baseRevision: "d".repeat(40) }],
  ])("fails closed on %s", async (_name, overrides) => {
    await publish(overrides);

    const response = await get();

    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("integrity check");
  });
});

import { describe, expect, it } from "vitest";

import { AgentSlice } from "@/lib/agent/workspace-tools";
import {
  WorkspaceController,
  type AgentWorkspace,
  type AgentWorkspaceCommand,
  type AgentWorkspaceResult,
} from "@/lib/agent/workspace";

class FakeWorkspace implements AgentWorkspace {
  readonly id = "sandbox_test";
  readonly description = "isolated test workspace";
  readonly commands: AgentWorkspaceCommand[] = [];

  constructor(
    private readonly existingPaths = new Set<string>(),
    private readonly diffOutput = "ok\n",
  ) {}

  async run(command: AgentWorkspaceCommand): Promise<AgentWorkspaceResult> {
    this.commands.push(command);
    if (command.command.startsWith("test ! -e ")) {
      const path = command.command.match(/'([^']+)'$/)?.[1] ?? "";
      return {
        exitCode: this.existingPaths.has(path) ? 1 : 0,
        stdout: "",
        stderr: "",
      };
    }
    if (command.command.startsWith("sed ")) {
      return { exitCode: 0, stdout: "export const value = 1;\n", stderr: "" };
    }
    if (command.command.startsWith("git diff --name-status")) {
      return {
        exitCode: 0,
        stdout: "M\tsrc/included.ts\n",
        stderr: "",
      };
    }
    if (command.command === "git diff --no-ext-diff -- .") {
      return { exitCode: 0, stdout: this.diffOutput, stderr: "" };
    }
    if (command.command.startsWith("git ls-files --others")) {
      return { exitCode: 0, stdout: "src/new.test.ts\n", stderr: "" };
    }
    if (command.env?.LOCUS_PATH) {
      return {
        exitCode: 0,
        stdout: Buffer.from(`contents:${command.env.LOCUS_PATH}`).toString("base64"),
        stderr: "",
      };
    }
    return { exitCode: 0, stdout: "ok\n", stderr: "" };
  }

  async stop(): Promise<void> {}
}

function setup() {
  const workspace = new FakeWorkspace();
  const slice = new AgentSlice({
    included: ["src/included.ts"],
    excluded: ["src/excluded.ts"],
  });
  return {
    workspace,
    slice,
    controller: new WorkspaceController(workspace, slice),
  };
}

describe("agent workspace", () => {
  it("cannot read excluded source until the Run records a Widen", async () => {
    const { controller, workspace } = setup();

    await expect(controller.readFile("src/excluded.ts")).rejects.toThrow(
      "src/excluded.ts is outside the active Slice",
    );
    expect(workspace.commands).toHaveLength(0);

    const widened = await controller.widenFile("src/excluded.ts");

    expect(widened).toContain("export const value");
    expect(controller.ledger().widened).toEqual(["src/excluded.ts"]);
  });

  it("searches only files currently readable by the agent", async () => {
    const { controller, workspace } = setup();

    await controller.search("value");

    expect(workspace.commands[0].command).toContain("'src/included.ts'");
    expect(workspace.commands[0].command).not.toContain("src/excluded.ts");
  });

  it("blocks external actions before they reach the sandbox", async () => {
    const { controller, workspace } = setup();

    await expect(controller.runCheck("git push origin main")).rejects.toThrow(
      "Command is outside the verification allowlist",
    );
    expect(workspace.commands).toHaveLength(0);
  });

  it("runs approved verification commands and returns bounded evidence", async () => {
    const { controller, workspace } = setup();

    const result = await controller.runCheck("pnpm test");

    expect(result).toContain("exit 0");
    expect(workspace.commands[0]).toMatchObject({
      command: "pnpm test",
      timeoutMs: 300_000,
    });
    expect(controller.verification()).toEqual([
      { command: "pnpm test", exitCode: 0, evidence: "exit 0\n\nstdout:\nok" },
    ]);
  });

  it("creates new files without silently reclassifying excluded files", async () => {
    const { controller, workspace } = setup();

    await controller.writeFile("src/new.test.ts", "test content");
    expect(controller.ledger().created).toEqual(["src/new.test.ts"]);
    expect(workspace.commands.find((command) => command.env?.LOCUS_CONTENT)?.env).toMatchObject({
      LOCUS_PATH: "src/new.test.ts",
      LOCUS_CONTENT: "test content",
    });

    await expect(controller.writeFile("src/excluded.ts", "replacement")).rejects.toThrow(
      "src/excluded.ts already exists outside the Slice",
    );
  });

  it("refuses to overwrite an existing file omitted from the source ledger", async () => {
    const workspace = new FakeWorkspace(new Set(["README.md"]));
    const controller = new WorkspaceController(
      workspace,
      new AgentSlice({ included: ["src/included.ts"], excluded: [] }),
    );

    await expect(controller.writeFile("README.md", "replacement")).rejects.toThrow(
      "README.md already exists outside the Slice",
    );
  });

  it("installs dependencies with lifecycle scripts disabled", async () => {
    const { controller, workspace } = setup();

    await controller.prepareDependencies();

    expect(workspace.commands[0].command).toContain("pnpm install --frozen-lockfile --ignore-scripts");
    expect(workspace.commands[0].command).toContain("npm ci --ignore-scripts");
  });

  it("includes untracked files in the approval diff", async () => {
    const { controller, workspace } = setup();
    await controller.writeFile("src/new.test.ts", "test content");

    await controller.diff();

    expect(workspace.commands.some(
      (command) => command.command === "git add --intent-to-add -- .",
    )).toBe(true);
  });

  it("keeps the human approval diff complete while bounding agent tool output", async () => {
    const diffOutput = "x".repeat(12_001);
    const workspace = new FakeWorkspace(new Set(), diffOutput);
    const controller = new WorkspaceController(
      workspace,
      new AgentSlice({ included: ["src/included.ts"], excluded: [] }),
    );

    await expect(controller.diff()).resolves.toContain("[truncated 17 characters]");
    await expect(controller.reviewDiff()).resolves.toBe(diffOutput);
  });

  it("captures a bounded delivery change set without reading excluded files", async () => {
    const { controller } = setup();
    await controller.writeFile("src/new.test.ts", "test content");

    await expect(controller.changeSet()).resolves.toEqual([
      { path: "src/included.ts", content: "contents:src/included.ts" },
      { path: "src/new.test.ts", content: "contents:src/new.test.ts" },
    ]);
  });
});

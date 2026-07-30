import { describe, expect, it } from "vitest";

import { AgentScope } from "@/lib/agent/workspace-tools";
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

  async run(command: AgentWorkspaceCommand): Promise<AgentWorkspaceResult> {
    this.commands.push(command);
    if (command.command.startsWith("sed ")) {
      return { exitCode: 0, stdout: "export const value = 1;\n", stderr: "" };
    }
    return { exitCode: 0, stdout: "ok\n", stderr: "" };
  }

  async stop(): Promise<void> {}
}

function setup() {
  const workspace = new FakeWorkspace();
  const scope = new AgentScope({
    included: ["src/included.ts"],
    excluded: ["src/excluded.ts"],
  });
  return {
    workspace,
    scope,
    controller: new WorkspaceController(workspace, scope),
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
  });

  it("creates new files without silently reclassifying excluded files", async () => {
    const { controller, workspace } = setup();

    await controller.writeFile("src/new.test.ts", "test content");
    expect(controller.ledger().created).toEqual(["src/new.test.ts"]);
    expect(workspace.commands[0].env).toMatchObject({
      LOCUS_PATH: "src/new.test.ts",
      LOCUS_CONTENT: "test content",
    });

    await expect(controller.writeFile("src/excluded.ts", "replacement")).rejects.toThrow(
      "src/excluded.ts already exists outside the Slice",
    );
  });
});

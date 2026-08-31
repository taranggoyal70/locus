import { describe, expect, it } from "vitest";

import { AgentSlice } from "@/lib/agent/workspace-tools";
import {
  WorkspaceController,
  type AgentWorkspace,
  type AgentWorkspaceCommand,
  type AgentWorkspaceFile,
  type AgentWorkspaceResult,
} from "@/lib/agent/workspace";

class FakeWorkspace implements AgentWorkspace {
  readonly id = "sandbox_test";
  readonly description = "isolated test workspace";
  readonly commands: AgentWorkspaceCommand[] = [];
  lockNetworkCalls = 0;
  // How many commands had already run when the network was revoked, so tests
  // can assert the lock landed before any repository-controlled program.
  commandsBeforeLock: number | null = null;
  lockNetworkError: Error | null = null;

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
    // Slice reads are the only operation that passes a character budget, which keeps
    // them distinguishable from the base64 whole-file capture below.
    if (command.env?.LOCUS_MAX_CHARACTERS) {
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

  async writeFile(file: AgentWorkspaceFile): Promise<void> {
    void file;
  }

  async lockNetwork(): Promise<void> {
    if (this.lockNetworkError) throw this.lockNetworkError;
    this.lockNetworkCalls += 1;
    if (this.commandsBeforeLock === null) this.commandsBeforeLock = this.commands.length;
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

    const widened = await controller.widenFile("src/excluded.ts", "the total is computed here");

    expect(widened).toContain("export const value");
    expect(controller.ledger().widened).toEqual(["src/excluded.ts"]);
  });

  it("can page through a large included file without skipping hidden characters", async () => {
    const { controller, workspace } = setup();

    await controller.readFile("src/included.ts", { offset: 10_000, maxCharacters: 8_000 });

    expect(workspace.commands[0].env).toMatchObject({
      LOCUS_PATH: "src/included.ts",
      LOCUS_OFFSET: "10000",
      LOCUS_MAX_CHARACTERS: "8000",
    });
  });

  it("searches only files currently readable by the agent", async () => {
    const { controller, workspace } = setup();

    await controller.search("value");

    // Paths travel in the environment now rather than as `rg` arguments, because
    // rg reads a symlinked path given explicitly and Slice paths are repository
    // controlled (R3). The property under test is unchanged: excluded files are
    // not searched.
    expect(workspace.commands[0].env?.LOCUS_PATHS).toBe(JSON.stringify(["src/included.ts"]));
    expect(workspace.commands[0].env?.LOCUS_PATHS).not.toContain("src/excluded.ts");
  });

  it("does not search with a shell tool that follows explicit symlinks", async () => {
    const { controller, workspace } = setup();

    await controller.search("value");

    expect(workspace.commands[0].command).not.toContain("rg ");
    expect(workspace.commands[0].command).toContain("node -e");
  });

  it("bounds the search path environment entry by UTF-8 bytes", async () => {
    const paths = Array.from(
      { length: 3_000 },
      (_, index) => `src/検索-${String(index).padStart(4, "0")}.ts`,
    );
    const workspace = new FakeWorkspace();
    const controller = new WorkspaceController(
      workspace,
      new AgentSlice({ included: paths, excluded: [] }),
    );

    const result = await controller.search("value");
    const encodedPaths = workspace.commands[0].env?.LOCUS_PATHS;

    expect(Buffer.byteLength(`LOCUS_PATHS=${encodedPaths}\0`, "utf8")).toBeLessThanOrEqual(60_000);
    expect((JSON.parse(encodedPaths ?? "[]") as string[]).length).toBeLessThan(paths.length);
    expect(result).toContain("readable path(s) exceeded the search path budget");
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
    await controller.lockNetwork();

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

  // R2: repository-controlled verification must never execute while the
  // sandbox can still reach the network.
  it("refuses to verify while the sandbox can still reach the network", async () => {
    const { controller, workspace } = setup();

    await expect(controller.runCheck("pnpm test")).rejects.toThrow(
      "Verification cannot run before the sandbox network is locked",
    );
    expect(workspace.commands).toHaveLength(0);
    expect(controller.verification()).toEqual([]);
  });

  it("still rejects a non-allowlisted command before mentioning the network", async () => {
    const { controller } = setup();

    // Command shape is checked first so the error names the real problem.
    await expect(controller.runCheck("curl https://example.com")).rejects.toThrow(
      "Command is outside the verification allowlist",
    );
  });

  it("locks the network before any repository-controlled program runs", async () => {
    const { controller, workspace } = setup();

    await controller.prepareDependencies();
    await controller.lockNetwork();
    await controller.runCheck("pnpm test");

    // Bootstrap is the only command permitted to precede the lock.
    expect(workspace.commandsBeforeLock).toBe(1);
    expect(workspace.commands[0].command).toContain("install");
  });

  it("leaves verification blocked when the platform refuses to revoke egress", async () => {
    const { controller, workspace } = setup();
    workspace.lockNetworkError = new Error("sandbox update failed");

    await expect(controller.lockNetwork()).rejects.toThrow("sandbox update failed");
    // Fail closed: a lock that did not take must not read as locked.
    expect(controller.networkIsLocked()).toBe(false);
    await expect(controller.runCheck("pnpm test")).rejects.toThrow(
      "Verification cannot run before the sandbox network is locked",
    );
  });

  it("revokes egress once even if asked repeatedly", async () => {
    const { controller, workspace } = setup();

    await controller.lockNetwork();
    await controller.lockNetwork();

    expect(workspace.lockNetworkCalls).toBe(1);
    expect(controller.networkIsLocked()).toBe(true);
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

  it("bounds the agent-facing diff, which is no longer a review artifact", async () => {
    const diffOutput = "x".repeat(12_001);
    const workspace = new FakeWorkspace(new Set(), diffOutput);
    const controller = new WorkspaceController(
      workspace,
      new AgentSlice({ included: ["src/included.ts"], excluded: [] }),
    );

    await expect(controller.diff()).resolves.toContain("[truncated 17 characters]");
    // R1 removed reviewDiff(). The reviewed artifact is built on the server
    // from the trusted base and the frozen candidate, so no method here can
    // supply it from the sandbox's mutable Git state.
    expect("reviewDiff" in controller).toBe(false);
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

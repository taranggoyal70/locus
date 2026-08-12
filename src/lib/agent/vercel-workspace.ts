import { Sandbox } from "@vercel/sandbox";

import type {
  AgentWorkspace,
  AgentWorkspaceCommand,
  AgentWorkspaceFile,
  AgentWorkspaceResult,
} from "@/lib/agent/workspace";

const PUBLIC_GITHUB_REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const GIT_REVISION = /^[A-Za-z0-9_./-]{1,200}$/;

export function normalizePublicGitHubRepository(input: string): string {
  const value = input.trim().replace(/\.git$/, "").replace(/\/$/, "");
  let repository = value;

  if (value.startsWith("https://")) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error("Repository must be a public GitHub owner/repository");
    }
    if (url.hostname !== "github.com" || url.username || url.password || url.search || url.hash) {
      throw new Error("Repository must be a public GitHub owner/repository");
    }
    repository = url.pathname.replace(/^\/|\/$/g, "");
  }

  if (!PUBLIC_GITHUB_REPOSITORY.test(repository)) {
    throw new Error("Repository must be a public GitHub owner/repository");
  }

  return `https://github.com/${repository}.git`;
}

// R2: the bootstrap phase needs the package registry to install from the
// frozen lockfile, and GitHub to acquire the source. Nothing after bootstrap
// needs either: the model runs server-side, so only its resulting commands
// execute here. This allowlist is therefore revoked by lockNetwork() before
// any repository-controlled program runs.
const BOOTSTRAP_NETWORK_ALLOWLIST = [
  "registry.npmjs.org",
  "*.npmjs.org",
  "github.com",
  "*.github.com",
  "*.githubusercontent.com",
];

export type VercelWorkspaceInput = {
  repository: string;
  revision?: string;
  runId: string;
  abortSignal?: AbortSignal;
};

export async function createVercelWorkspace(
  input: VercelWorkspaceInput,
): Promise<AgentWorkspace> {
  const repository = normalizePublicGitHubRepository(input.repository);
  const revision = input.revision?.trim();
  if (revision && !GIT_REVISION.test(revision)) {
    throw new Error("Git revision contains unsupported characters");
  }

  const safeRunId = input.runId.replace(/[^A-Za-z0-9-]/g, "-").slice(0, 40);
  const sandbox = await Sandbox.create({
    name: `locus-${safeRunId || "run"}`,
    source: {
      type: "git",
      url: repository,
      depth: 50,
      revision: revision || undefined,
    },
    runtime: "node24",
    timeout: 15 * 60 * 1000,
    resources: { vcpus: 2 },
    persistent: false,
    networkPolicy: { allow: BOOTSTRAP_NETWORK_ALLOWLIST },
    tags: {
      product: "locus",
      purpose: "coding-agent",
      run: safeRunId || "run",
    },
    signal: input.abortSignal,
  });

  return {
    id: sandbox.name,
    description: `Vercel Sandbox ${sandbox.name}`,
    async run(command: AgentWorkspaceCommand): Promise<AgentWorkspaceResult> {
      const result = await sandbox.runCommand({
        cmd: "sh",
        args: ["-lc", command.command],
        cwd: command.workingDirectory,
        env: command.env,
        signal: command.abortSignal,
        timeoutMs: command.timeoutMs,
      });
      const [stdout, stderr] = await Promise.all([
        result.stdout({ signal: command.abortSignal }),
        result.stderr({ signal: command.abortSignal }),
      ]);
      return { exitCode: result.exitCode, stdout, stderr };
    },
    async writeFile(file: AgentWorkspaceFile): Promise<void> {
      await sandbox.writeFiles(
        [{ path: file.path, content: file.content }],
        { signal: file.abortSignal },
      );
    },
    async lockNetwork(abortSignal?: AbortSignal): Promise<void> {
      // Verified against @vercel/sandbox 2.9.0: `update` is the supported
      // entry point and `updateNetworkPolicy` is deprecated. "deny-all" is a
      // NetworkPolicy literal, so the revocation is applied by the platform to
      // the running sandbox rather than configured inside the guest where
      // repository-controlled code could undo it.
      await sandbox.update({ networkPolicy: "deny-all" }, { signal: abortSignal });
    },
    async stop(): Promise<void> {
      await sandbox.stop();
    },
  };
}

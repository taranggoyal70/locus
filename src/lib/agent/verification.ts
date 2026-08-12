import { randomUUID } from "node:crypto";

import { candidateDigestMatches, type FrozenCandidate } from "@/lib/agent/candidate";
import { CONTAINMENT_PRELUDE, type AgentWorkspace } from "@/lib/agent/workspace";
import { validateAgentCommand, validateRepoPath } from "@/lib/agent/workspace-tools";

/**
 * R1/R2 verification isolation.
 *
 * The edit sandbox stops being authoritative the moment editing ends. Once a
 * repository-controlled program has run there — every `pnpm test`, every build
 * script — the tree it leaves behind is attacker-influenced, so "tests passed"
 * in that sandbox does not describe the bytes that were frozen as the candidate.
 *
 * This module produces evidence that does describe them: materialize exactly the
 * frozen candidate into a fresh sandbox, under deny-all networking, and run the
 * approved commands there. The property is verification-to-candidate
 * correspondence, and it comes from *where* the checks ran, not from the checks
 * themselves.
 *
 * Nothing here trusts the guest. Every file written is read back and hashed
 * against the frozen digest before any check is allowed to run.
 */

export type VerificationCheck = {
  command: string;
  exitCode: number;
  output: string;
};

export type IsolatedVerification = {
  sandboxId: string;
  candidateSha256: string;
  checks: VerificationCheck[];
};

export class VerificationIsolationError extends Error {}

const MAX_OUTPUT_CHARACTERS = 20_000;
const VERIFICATION_COMMAND_TIMEOUT_MS = 300_000;

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

// The payload is copied into a host-chosen temp file before this script runs, so
// candidate content never travels through argv, shell text, or environment
// variables. `contain()` from the prelude resolves the target path where the
// filesystem is, which is what rejects a candidate path that is a symlink out of
// the workspace. The script prints the digest it observed; the host compares it,
// so the decision is not delegated to the guest.
const MATERIALIZE_SCRIPT = CONTAINMENT_PRELUDE + [
  "const crypto=require('node:crypto');",
  "const target=contain(process.env.LOCUS_PATH);",
  "const payload=process.env.LOCUS_PAYLOAD;",
  'if(!payload||!/^\\/tmp\\/locus-candidate-[A-Fa-f0-9-]{36}\\.payload$/.test(payload))throw new Error("missing write input");',
  "const content=fs.readFileSync(payload);",
  "fs.mkdirSync(path.dirname(target),{recursive:true});",
  "fs.writeFileSync(target,content);",
  "fs.rmSync(payload,{force:true});",
  "const written=fs.readFileSync(target);",
  "process.stdout.write(crypto.createHash('sha256').update(written).digest('hex'));",
].join("");

const DELETE_SCRIPT = CONTAINMENT_PRELUDE + [
  "const target=contain(process.env.LOCUS_PATH);",
  "fs.rmSync(target,{force:true,recursive:false});",
  "process.stdout.write(fs.existsSync(target)?'present':'absent');",
].join("");

function truncate(value: string): string {
  return value.length > MAX_OUTPUT_CHARACTERS
    ? `${value.slice(0, MAX_OUTPUT_CHARACTERS)}\n[output truncated]`
    : value;
}

function materializationPayloadPath(): string {
  return `/tmp/locus-candidate-${randomUUID()}.payload`;
}

/**
 * Write the frozen bytes into the sandbox and prove each one landed intact.
 *
 * Content goes in over stdin rather than inside the command string: a heredoc or
 * an echo would let file content terminate the command and inject a new one, and
 * candidate content is agent-authored.
 */
async function materializeCandidate(
  workspace: AgentWorkspace,
  candidate: FrozenCandidate,
  abortSignal?: AbortSignal,
): Promise<void> {
  for (const path of candidate.deletedPaths) {
    const target = validateRepoPath(path);
    const removed = await workspace.run({
      command: `node -e ${shellQuote(DELETE_SCRIPT)}`,
      env: { LOCUS_PATH: target },
      abortSignal,
      timeoutMs: 30_000,
    });
    if (removed.exitCode !== 0 || removed.stdout.trim() !== "absent") {
      throw new VerificationIsolationError(
        `Deleted path is still present after materialization: ${path}`,
      );
    }
  }

  for (const file of candidate.files) {
    const target = validateRepoPath(file.path);
    const payload = materializationPayloadPath();
    await workspace.writeFile({
      path: payload,
      content: Buffer.from(file.content, "utf8"),
      abortSignal,
    });
    const written = await workspace.run({
      command: `node -e ${shellQuote(MATERIALIZE_SCRIPT)}`,
      env: { LOCUS_PATH: target, LOCUS_PAYLOAD: payload },
      abortSignal,
      timeoutMs: 30_000,
    });
    if (written.exitCode !== 0) {
      throw new VerificationIsolationError(
        `Could not write ${file.path} into the verification sandbox`,
      );
    }
    // Compare on the host against the frozen digest. Evidence is only worth
    // anything if the tree it describes is byte-identical to the candidate that
    // will be delivered, so a mismatch aborts rather than downgrades.
    if (written.stdout.trim() !== file.sha256) {
      throw new VerificationIsolationError(
        `Materialized bytes do not match the frozen candidate for ${file.path}`,
      );
    }
  }
}

/**
 * Run the approved commands against exactly the frozen candidate.
 *
 * `workspace` must be a freshly created sandbox cloned at `candidate.baseSha`
 * whose dependencies are bootstrapped and whose network is already locked. This
 * function never unlocks anything and never runs a command it was not given.
 */
export async function verifyFrozenCandidate(input: {
  workspace: AgentWorkspace;
  candidate: FrozenCandidate;
  commands: readonly string[];
  networkIsLocked: boolean;
  abortSignal?: AbortSignal;
}): Promise<IsolatedVerification> {
  const { workspace, candidate, commands, networkIsLocked, abortSignal } = input;

  // Refuse rather than silently verify with egress: a check that can reach the
  // network can fetch a payload or exfiltrate, which is what R2 closed for the
  // edit sandbox. The same phase ordering has to hold here.
  if (!networkIsLocked) {
    throw new VerificationIsolationError(
      "Verification sandbox network is not locked; refusing to run repository-controlled commands",
    );
  }
  if (!candidateDigestMatches(candidate)) {
    throw new VerificationIsolationError("Frozen candidate digest does not match its contents");
  }
  if (commands.length === 0) {
    throw new VerificationIsolationError("No approved verification command to run");
  }

  // Re-validate here rather than trusting the caller: this is the boundary that
  // decides what executes against the candidate.
  const approved = commands.map((command) => validateAgentCommand(command));

  await materializeCandidate(workspace, candidate, abortSignal);

  const checks: VerificationCheck[] = [];
  for (const command of approved) {
    const result = await workspace.run({
      command,
      abortSignal,
      timeoutMs: VERIFICATION_COMMAND_TIMEOUT_MS,
    });
    checks.push({
      command,
      exitCode: result.exitCode,
      output: truncate(
        [
          `exit ${result.exitCode}`,
          result.stdout.trim() && `stdout:\n${result.stdout.trim()}`,
          result.stderr.trim() && `stderr:\n${result.stderr.trim()}`,
        ]
          .filter(Boolean)
          .join("\n\n"),
      ),
    });
  }

  return {
    sandboxId: workspace.id,
    candidateSha256: candidate.candidateSha256,
    checks,
  };
}

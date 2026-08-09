import { createHash } from "node:crypto";

import { validateRepoPath } from "@/lib/agent/workspace-tools";

// R1: candidate integrity.
//
// The review diff a human approves and the change set that is later delivered
// were previously two independent reads of a mutable sandbox tree, taken after
// repository-controlled verification had already had the chance to run. A
// verification script could stage malicious state B, rewrite the working file
// to C = B + <innocuous edit>, and leave `git diff` showing only the innocuous
// part while the captured change set still contained B.
//
// The fix is to stop deriving anything from sandbox Git state. Freeze the
// candidate bytes once, then build the review diff on the server from the
// trusted base and those frozen bytes, and refuse to publish unless applying
// that diff to the trusted base reproduces the frozen candidate exactly.
//
// Diff granularity note: hunks are produced by trimming the common prefix and
// suffix and emitting the differing middle as one replacement. That is less
// granular than an LCS diff for large rewrites, but it is deterministic and
// its applier is its exact inverse. For security-critical code, an obviously
// correct diff is worth more than a minimal one.

export type FrozenFile = {
  path: string;
  sha256: string;
  content: string;
};

export type FrozenCandidate = {
  baseSha: string;
  // Added or modified files, sorted by path.
  files: readonly FrozenFile[];
  // Paths removed relative to the base, sorted.
  deletedPaths: readonly string[];
  candidateSha256: string;
};

export type BaseTree = ReadonlyMap<string, string>;

// Non-printable separators that cannot appear in a validated repo path, so a
// path cannot forge a different candidate with the same digest. Written as
// escapes rather than literal control bytes so tooling cannot silently strip
// them. Mirrors the framing publish_agent_proposal already uses in SQL.
const RECORD_SEPARATOR = "\x1e";
const UNIT_SEPARATOR = "\x1f";

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

// The candidate digest must change if any path, byte, or deletion changes, and
// must not depend on the order the sandbox happened to enumerate files.
function digestCandidate(
  baseSha: string,
  files: readonly FrozenFile[],
  deletedPaths: readonly string[],
): string {
  const parts = [
    baseSha,
    files.map((file) => `${file.path}${UNIT_SEPARATOR}${file.sha256}`).join(UNIT_SEPARATOR),
    deletedPaths.join(UNIT_SEPARATOR),
  ];
  return sha256Hex(parts.join(RECORD_SEPARATOR));
}

export type CandidateChange = {
  path: string;
  // null marks a deletion, matching AgentChange.
  content: string | null;
};

export function freezeCandidate(input: {
  baseSha: string;
  changes: readonly CandidateChange[];
}): FrozenCandidate {
  const baseSha = input.baseSha.trim();
  if (!baseSha) throw new Error("Frozen candidate requires a trusted base revision");

  const files: FrozenFile[] = [];
  const deletedPaths: string[] = [];
  const seen = new Set<string>();

  for (const change of input.changes) {
    const path = validateRepoPath(change.path);
    // Two entries for one path would make the candidate ambiguous, and which
    // one won would depend on iteration order.
    if (seen.has(path)) throw new Error(`Duplicate path in candidate: ${path}`);
    seen.add(path);

    if (change.content === null) {
      deletedPaths.push(path);
      continue;
    }
    files.push({ path, sha256: sha256Hex(change.content), content: change.content });
  }

  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  deletedPaths.sort();

  return {
    baseSha,
    files,
    deletedPaths,
    candidateSha256: digestCandidate(baseSha, files, deletedPaths),
  };
}

// Re-derive the digest from the parts rather than trusting a stored field.
export function candidateDigestMatches(candidate: FrozenCandidate): boolean {
  return (
    candidate.candidateSha256
    === digestCandidate(candidate.baseSha, candidate.files, candidate.deletedPaths)
  );
}

function splitLines(value: string): string[] {
  // split/join on "\n" is lossless in both directions, so a trailing newline
  // round-trips as a final empty element without a "\ No newline" marker.
  return value.split("\n");
}

function commonPrefix(a: readonly string[], b: readonly string[]): number {
  const limit = Math.min(a.length, b.length);
  let index = 0;
  while (index < limit && a[index] === b[index]) index += 1;
  return index;
}

function commonSuffix(a: readonly string[], b: readonly string[], prefix: number): number {
  const limit = Math.min(a.length, b.length) - prefix;
  let index = 0;
  while (index < limit && a[a.length - 1 - index] === b[b.length - 1 - index]) index += 1;
  return index;
}

function fileHeader(path: string, existedBefore: boolean, existsAfter: boolean): string[] {
  return [
    `diff --git a/${path} b/${path}`,
    existedBefore ? `--- a/${path}` : "--- /dev/null",
    existsAfter ? `+++ b/${path}` : "+++ /dev/null",
  ];
}

function buildFileDiff(path: string, before: string | null, after: string | null): string[] {
  const beforeLines = before === null ? [] : splitLines(before);
  const afterLines = after === null ? [] : splitLines(after);
  if (before !== null && after !== null && before === after) return [];

  const prefix = commonPrefix(beforeLines, afterLines);
  const suffix = commonSuffix(beforeLines, afterLines, prefix);
  const removed = beforeLines.slice(prefix, beforeLines.length - suffix);
  const added = afterLines.slice(prefix, afterLines.length - suffix);

  const lines = fileHeader(path, before !== null, after !== null);
  lines.push(
    `@@ -${prefix + 1},${removed.length} +${prefix + 1},${added.length} @@`,
  );
  for (const line of removed) lines.push(`-${line}`);
  for (const line of added) lines.push(`+${line}`);
  return lines;
}

export function buildDeterministicDiff(base: BaseTree, candidate: FrozenCandidate): string {
  const sections: string[] = [];
  // Sorted inputs plus a fixed section order make the diff a pure function of
  // (base, candidate), so its hash is stable across runs and machines.
  for (const file of candidate.files) {
    const before = base.get(file.path);
    sections.push(...buildFileDiff(file.path, before === undefined ? null : before, file.content));
  }
  for (const path of candidate.deletedPaths) {
    const before = base.get(path);
    if (before === undefined) throw new Error(`Candidate deletes a path absent from the base: ${path}`);
    sections.push(...buildFileDiff(path, before, null));
  }
  return sections.length === 0 ? "" : `${sections.join("\n")}\n`;
}

const HUNK_HEADER = /^@@ -(\d+),(\d+) \+(\d+),(\d+) @@$/;

export type AppliedTree = {
  files: Map<string, string>;
  deletedPaths: Set<string>;
};

// The exact inverse of buildDeterministicDiff. It deliberately reimplements
// application from the diff text rather than reusing the candidate, because
// its whole purpose is to check the diff independently.
export function applyCandidateDiff(base: BaseTree, diff: string): AppliedTree {
  const files = new Map<string, string>();
  const deletedPaths = new Set<string>();
  if (diff === "") return { files, deletedPaths };

  const lines = diff.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();

  let index = 0;
  while (index < lines.length) {
    const header = lines[index];
    if (!header.startsWith("diff --git ")) {
      throw new Error(`Malformed diff at line ${index + 1}: expected a file header`);
    }
    const fromLine = lines[index + 1];
    const toLine = lines[index + 2];
    if (fromLine === undefined || toLine === undefined) throw new Error("Truncated diff header");

    const existedBefore = fromLine !== "--- /dev/null";
    const existsAfter = toLine !== "+++ /dev/null";
    const path = validateRepoPath(
      existsAfter ? toLine.slice("+++ b/".length) : fromLine.slice("--- a/".length),
    );
    if (`diff --git a/${path} b/${path}` !== header) {
      throw new Error(`Diff header does not agree with its paths: ${path}`);
    }

    const hunk = HUNK_HEADER.exec(lines[index + 3] ?? "");
    if (!hunk) throw new Error(`Malformed hunk header for ${path}`);
    const start = Number(hunk[1]) - 1;
    const removedCount = Number(hunk[2]);
    const addedCount = Number(hunk[4]);

    let cursor = index + 4;
    const removed: string[] = [];
    for (let n = 0; n < removedCount; n += 1, cursor += 1) {
      const line = lines[cursor];
      if (line === undefined || !line.startsWith("-")) throw new Error(`Truncated removals for ${path}`);
      removed.push(line.slice(1));
    }
    const added: string[] = [];
    for (let n = 0; n < addedCount; n += 1, cursor += 1) {
      const line = lines[cursor];
      if (line === undefined || !line.startsWith("+")) throw new Error(`Truncated additions for ${path}`);
      added.push(line.slice(1));
    }

    const beforeContent = existedBefore ? base.get(path) : undefined;
    if (existedBefore && beforeContent === undefined) {
      throw new Error(`Diff modifies a path absent from the trusted base: ${path}`);
    }
    const beforeLines = beforeContent === undefined ? [] : splitLines(beforeContent);

    // The removed block must match the base at the stated offset, or the diff
    // is describing a tree other than the one being reviewed against.
    const actual = beforeLines.slice(start, start + removedCount);
    if (actual.length !== removed.length || actual.some((line, n) => line !== removed[n])) {
      throw new Error(`Diff context does not match the trusted base for ${path}`);
    }

    if (existsAfter) {
      files.set(path, [
        ...beforeLines.slice(0, start),
        ...added,
        ...beforeLines.slice(start + removedCount),
      ].join("\n"));
    } else {
      deletedPaths.add(path);
    }
    index = cursor;
  }

  return { files, deletedPaths };
}

export class CandidateIntegrityError extends Error {}

// The security invariant. Publishing must be impossible unless this holds:
// the artifact a human reviewed reconstructs, byte for byte, the artifact that
// will be delivered.
export function assertCandidateIntegrity(input: {
  base: BaseTree;
  diff: string;
  candidate: FrozenCandidate;
}): void {
  const { base, diff, candidate } = input;

  if (!candidateDigestMatches(candidate)) {
    throw new CandidateIntegrityError("Frozen candidate digest does not match its contents");
  }

  const applied = applyCandidateDiff(base, diff);

  if (applied.files.size !== candidate.files.length) {
    throw new CandidateIntegrityError(
      `Reviewed diff yields ${applied.files.size} files but the candidate holds ${candidate.files.length}`,
    );
  }
  for (const file of candidate.files) {
    const reconstructed = applied.files.get(file.path);
    if (reconstructed === undefined) {
      throw new CandidateIntegrityError(`Reviewed diff omits ${file.path}`);
    }
    if (reconstructed !== file.content) {
      throw new CandidateIntegrityError(
        `Applying the reviewed diff does not reproduce ${file.path}`,
      );
    }
    if (sha256Hex(reconstructed) !== file.sha256) {
      throw new CandidateIntegrityError(`Content hash mismatch for ${file.path}`);
    }
  }

  if (applied.deletedPaths.size !== candidate.deletedPaths.length) {
    throw new CandidateIntegrityError("Reviewed diff and candidate disagree on deletions");
  }
  for (const path of candidate.deletedPaths) {
    if (!applied.deletedPaths.has(path)) {
      throw new CandidateIntegrityError(`Reviewed diff does not delete ${path}`);
    }
  }
}

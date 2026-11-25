import {
  applyCandidateDiff,
  assertCandidateIntegrity,
  buildDeterministicDiff,
  freezeCandidate,
  type FrozenCandidate,
} from "@/lib/agent/candidate";
import { proposalPatchFilename } from "@/lib/agent/run-review";

/**
 * Turns a stored Review-ready proposal into a patch `git apply` accepts.
 *
 * The stored diff is the Review format, not a git patch: it carries no context
 * lines, writes a trailing newline as an extra empty line, and has no
 * new-file or deleted-file headers, so git refuses most of them. It stays as it
 * is, because its hash is part of the proposal a human decides on. The git patch
 * is derived from it here instead, and only when the stored diff and the frozen
 * candidate still agree byte for byte.
 */
export class ProposalPatchError extends Error {}

const CONTEXT_LINES = 3;
const DIFF_HUNK = /^@@ -(\d+),(\d+) \+(\d+),(\d+) @@$/;
const FULL_SHA = /^[0-9a-f]{40}$/;

/** The exact inverse of a stored diff: applied to the candidate, it yields the base. */
function reverseDiff(diff: string): string {
  if (diff === "") return "";
  const lines = diff.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  const reversed: string[] = [];

  let index = 0;
  while (index < lines.length) {
    const [header, from, to] = lines.slice(index, index + 3);
    const hunk = DIFF_HUNK.exec(lines[index + 3] ?? "");
    if (!header?.startsWith("diff --git ") || !from?.startsWith("--- ") || !to?.startsWith("+++ ") || !hunk) {
      throw new ProposalPatchError("The stored diff is malformed");
    }
    const [, oldStart, oldCount, newStart, newCount] = hunk;
    const removedEnd = index + 4 + Number(oldCount);
    const addedEnd = removedEnd + Number(newCount);
    if (addedEnd > lines.length) throw new ProposalPatchError("The stored diff is truncated");

    reversed.push(
      header,
      `--- ${to.slice(4).replace(/^b\//, "a/")}`,
      `+++ ${from.slice(4).replace(/^a\//, "b/")}`,
      `@@ -${newStart},${newCount} +${oldStart},${oldCount} @@`,
      ...lines.slice(removedEnd, addedEnd).map((line) => `-${line.slice(1)}`),
      ...lines.slice(index + 4, removedEnd).map((line) => `+${line.slice(1)}`),
    );
    index = addedEnd;
  }
  return `${reversed.join("\n")}\n`;
}

/** Recovers the trusted base of every changed file from the stored evidence alone. */
function recoverBase(candidate: FrozenCandidate, diff: string): Map<string, string> {
  const after = new Map(candidate.files.map((file) => [file.path, file.content]));
  try {
    const base = applyCandidateDiff(after, reverseDiff(diff)).files;
    // Two independent statements of the same fact: the recovered base must
    // regenerate the reviewed diff exactly, and the reviewed diff must
    // reconstruct the frozen candidate exactly.
    if (buildDeterministicDiff(base, candidate) !== diff) {
      throw new ProposalPatchError("The stored diff does not match the frozen candidate");
    }
    assertCandidateIntegrity({ base, diff, candidate });
    return base;
  } catch (error) {
    if (error instanceof ProposalPatchError) throw error;
    throw new ProposalPatchError("The stored diff does not match the frozen candidate", { cause: error });
  }
}

/** Lines with their terminators, so a missing final newline is visible. */
function gitLines(value: string): string[] {
  return value.match(/[^\n]*\n|[^\n]+$/g) ?? [];
}

function emit(prefix: " " | "-" | "+", line: string): string {
  return line.endsWith("\n") ? `${prefix}${line}` : `${prefix}${line}\n\\ No newline at end of file\n`;
}

function range(start: number, count: number): string {
  // git counts from 1, except that an empty range names the line before it.
  return `${count === 0 ? start : start + 1},${count}`;
}

function gitFilePatch(path: string, before: string | null, after: string | null): string {
  const oldLines = before === null ? [] : gitLines(before);
  const newLines = after === null ? [] : gitLines(after);

  const limit = Math.min(oldLines.length, newLines.length);
  let prefix = 0;
  while (prefix < limit && oldLines[prefix] === newLines[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < limit - prefix
    && oldLines[oldLines.length - 1 - suffix] === newLines[newLines.length - 1 - suffix]
  ) suffix += 1;

  let patch = `diff --git a/${path} b/${path}\n`;
  if (before === null) patch += "new file mode 100644\n";
  if (after === null) patch += "deleted file mode 100644\n";
  const removed = oldLines.slice(prefix, oldLines.length - suffix);
  const added = newLines.slice(prefix, newLines.length - suffix);
  if (removed.length === 0 && added.length === 0) return patch;

  // git ends a path that contains a space with a tab, so the name is unambiguous.
  const end = path.includes(" ") ? "\t\n" : "\n";
  const start = Math.max(0, prefix - CONTEXT_LINES);
  const leading = oldLines.slice(start, prefix);
  const trailing = oldLines.slice(oldLines.length - suffix, oldLines.length - suffix + CONTEXT_LINES);
  const context = leading.length + trailing.length;

  patch += before === null ? "--- /dev/null\n" : `--- a/${path}${end}`;
  patch += after === null ? "+++ /dev/null\n" : `+++ b/${path}${end}`;
  patch += `@@ -${range(start, context + removed.length)} +${range(start, context + added.length)} @@\n`;
  for (const line of leading) patch += emit(" ", line);
  for (const line of removed) patch += emit("-", line);
  for (const line of added) patch += emit("+", line);
  for (const line of trailing) patch += emit(" ", line);
  return patch;
}

export type ProposalPatchInput = {
  runId: string;
  proposalHash: string;
  reviewed: boolean;
  /** The stored `change_set` artifact, verbatim. */
  changeSet: string;
  /** The stored `diff` artifact, verbatim. */
  diff: string;
};

export type ProposalPatch = {
  filename: string;
  baseRevision: string;
  content: string;
};

export function buildProposalPatch(input: ProposalPatchInput): ProposalPatch {
  let parsed: {
    version?: unknown;
    baseCommitSha?: unknown;
    candidateSha256?: unknown;
    files?: unknown;
  };
  try {
    parsed = JSON.parse(input.changeSet);
  } catch (error) {
    throw new ProposalPatchError("The stored change set is unreadable", { cause: error });
  }
  // Version 1 predates the frozen candidate digest, so it cannot be checked.
  if (
    parsed?.version !== 2
    || typeof parsed.baseCommitSha !== "string"
    || !FULL_SHA.test(parsed.baseCommitSha)
    || !Array.isArray(parsed.files)
    || parsed.files.length === 0
    || !parsed.files.every((file) => (
      typeof file?.path === "string" && (file.content === null || typeof file.content === "string")
    ))
  ) {
    throw new ProposalPatchError("The stored change set is not a supported version");
  }

  let candidate: FrozenCandidate;
  try {
    candidate = freezeCandidate({ baseSha: parsed.baseCommitSha, changes: parsed.files });
  } catch (error) {
    throw new ProposalPatchError("The stored change set is invalid", { cause: error });
  }
  if (candidate.candidateSha256 !== parsed.candidateSha256) {
    throw new ProposalPatchError("The stored change set does not match its frozen digest");
  }

  const base = recoverBase(candidate, input.diff);
  const sections = [
    ...candidate.files.map((file) => ({ path: file.path, after: file.content as string | null })),
    ...candidate.deletedPaths.map((path) => ({ path, after: null })),
  ];
  // Text before the first "diff" line is ignored by git. Only values with a
  // fixed shape go here: free text such as the task could forge a file section.
  const preamble = [
    `Locus proposal ${input.proposalHash}`,
    `Run: ${input.runId}`,
    `Base: ${candidate.baseSha}`,
    `Review: ${input.reviewed ? "accepted" : "pending"}`,
    "",
    "",
  ].join("\n");

  return {
    filename: proposalPatchFilename(input.runId),
    baseRevision: candidate.baseSha,
    content: preamble + sections
      .map(({ path, after }) => gitFilePatch(path, base.get(path) ?? null, after))
      .join(""),
  };
}

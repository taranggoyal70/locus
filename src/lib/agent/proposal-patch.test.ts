import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { buildDeterministicDiff, freezeCandidate, type CandidateChange } from "@/lib/agent/candidate";
import { buildProposalPatch, ProposalPatchError } from "@/lib/agent/proposal-patch";

const BASE_SHA = "a".repeat(40);
const RUN_ID = "0123abcd-0000-4000-8000-000000000001";
const PROPOSAL_HASH = "b".repeat(64);
const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function lines(count: number): string {
  return Array.from({ length: count }, (_, index) => `line ${index + 1}\n`).join("");
}

function stored(base: Record<string, string>, changes: CandidateChange[]) {
  const candidate = freezeCandidate({ baseSha: BASE_SHA, changes });
  return {
    changeSet: JSON.stringify({
      version: 2,
      baseCommitSha: BASE_SHA,
      candidateSha256: candidate.candidateSha256,
      files: changes,
    }),
    diff: buildDeterministicDiff(new Map(Object.entries(base)), candidate),
  };
}

function build(base: Record<string, string>, changes: CandidateChange[], reviewed = true) {
  return buildProposalPatch({
    runId: RUN_ID, proposalHash: PROPOSAL_HASH, reviewed, ...stored(base, changes),
  });
}

function checkout(base: Record<string, string>): string {
  const directory = mkdtempSync(join(tmpdir(), "locus-patch-"));
  directories.push(directory);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: directory, stdio: "pipe" });
  git("init", "-q");
  git("config", "core.autocrlf", "false");
  for (const [path, content] of Object.entries(base)) {
    mkdirSync(dirname(join(directory, path)), { recursive: true });
    writeFileSync(join(directory, path), content);
  }
  git("add", "-A");
  git("-c", "user.name=t", "-c", "user.email=t@example.test", "commit", "-qm", "base", "--allow-empty");
  return directory;
}

function apply(directory: string, patch: string): void {
  // Outside the checkout, so the patch file is never part of what it changes.
  const file = `${directory}.patch`;
  directories.push(file);
  writeFileSync(file, patch);
  execFileSync("git", ["apply", "--index", file], { cwd: directory, stdio: "pipe" });
}

const CASES: Array<[string, Record<string, string>, CandidateChange[]]> = [
  ["an edit in the middle", { "a.ts": lines(20) }, [{ path: "a.ts", content: lines(20).replace("line 10\n", "ten\n") }]],
  ["an edit on the first line", { "a.ts": lines(20) }, [{ path: "a.ts", content: lines(20).replace("line 1\n", "one\n") }]],
  ["an append", { "a.ts": lines(20) }, [{ path: "a.ts", content: `${lines(20)}more\n` }]],
  ["a truncation", { "a.ts": lines(20) }, [{ path: "a.ts", content: lines(4) }]],
  ["two separated edits", { "a.ts": lines(40) }, [{ path: "a.ts", content: lines(40).replace("line 5\n", "five\n").replace("line 35\n", "x\n") }]],
  ["a new file", { "a.ts": lines(3) }, [{ path: "deep/er/new.ts", content: "hello\nworld\n" }]],
  ["a new file with no final newline", { "a.ts": lines(3) }, [{ path: "new.ts", content: "hello" }]],
  ["an empty new file", { "a.ts": lines(3) }, [{ path: "empty.ts", content: "" }]],
  ["a deletion", { "a.ts": lines(3), "c.ts": lines(2) }, [{ path: "c.ts", content: null }]],
  ["a deletion with no final newline", { "a.ts": lines(3), "c.ts": "x" }, [{ path: "c.ts", content: null }]],
  ["a file emptied", { "a.ts": lines(3) }, [{ path: "a.ts", content: "" }]],
  ["an empty file filled", { "a.ts": "" }, [{ path: "a.ts", content: lines(2) }]],
  ["an edit with no final newline", { "a.ts": "x\ny" }, [{ path: "a.ts", content: "x\nz" }]],
  ["a final newline added", { "a.ts": "x\ny" }, [{ path: "a.ts", content: "x\ny\n" }]],
  ["a final newline removed", { "a.ts": "x\ny\n" }, [{ path: "a.ts", content: "x\ny" }]],
  ["CRLF line endings", { "a.ts": "x\r\ny\r\nz\r\n" }, [{ path: "a.ts", content: "x\r\nY\r\nz\r\n" }]],
  ["content that looks like a diff", { "a.ts": "--- a/x\n+++ b/x\n@@ -1,1 +1,1 @@\n" }, [{ path: "a.ts", content: "--- a/y\n+++ b/x\n@@ -1,2 +1,1 @@\ndiff --git a/q b/q\n" }]],
  ["paths with spaces and accents", { "my app/é page.tsx": lines(5) }, [
    { path: "my app/é page.tsx", content: lines(6) },
    { path: "my app/new one.ts", content: "x\n" },
    { path: "my app/empty one.ts", content: "" },
  ]],
  ["several files at once", { "a.ts": lines(9), "b.ts": lines(9), "c.ts": lines(2) }, [
    { path: "c.ts", content: null },
    { path: "b.ts", content: lines(8) },
    { path: "z.ts", content: "z\n" },
    { path: "a.ts", content: `first\n${lines(9)}` },
  ]],
];

describe("buildProposalPatch", () => {
  it.each(CASES)("git applies %s and gets the reviewed bytes", (_name, base, changes) => {
    const directory = checkout(base);

    apply(directory, build(base, changes).content);

    for (const change of changes) {
      const target = join(directory, change.path);
      if (change.content === null) expect(existsSync(target)).toBe(false);
      else expect(readFileSync(target, "utf8")).toBe(change.content);
    }
    const touched = execFileSync("git", ["diff", "--cached", "--name-only", "-z"], { cwd: directory, encoding: "utf8" })
      .split("\0").filter(Boolean).sort();
    expect(touched).toEqual(changes.map((change) => change.path).sort());
  });

  it("refuses to apply where the code has moved on", () => {
    const base = { "a.ts": lines(20) };
    const directory = checkout({ "a.ts": lines(20).replace("line 10\n", "someone else\n") });
    const patch = build(base, [{ path: "a.ts", content: lines(20).replace("line 10\n", "ten\n") }]);

    expect(() => apply(directory, patch.content)).toThrow(/patch (failed|does not apply)/);
  });

  it("names the Run, proposal, base and Review state, and a safe filename", () => {
    const base = { "a.ts": lines(2) };
    const changes = [{ path: "a.ts", content: lines(3) }];
    const patch = build(base, changes, false);

    expect(patch.filename).toBe("locus-0123abcd.patch");
    expect(patch.baseRevision).toBe(BASE_SHA);
    expect(patch.content).toContain(`Locus proposal ${PROPOSAL_HASH}`);
    expect(patch.content).toContain(`Base: ${BASE_SHA}`);
    expect(patch.content).toContain("Review: pending");
    expect(build(base, changes).content).toContain("Review: accepted");
  });
});

describe("buildProposalPatch refuses evidence that does not agree", () => {
  const base = { "a.ts": lines(5), "gone.ts": lines(2) };
  const changes: CandidateChange[] = [{ path: "a.ts", content: lines(6) }, { path: "gone.ts", content: null }];
  const attempt = (override: { changeSet?: string; diff?: string }) => () => buildProposalPatch({
    runId: RUN_ID, proposalHash: PROPOSAL_HASH, reviewed: true, ...stored(base, changes), ...override,
  });

  it.each([
    ["an edited change set", { changeSet: stored(base, changes).changeSet.replace("line 6", "evil 6") }],
    ["a change set that is not JSON", { changeSet: "{" }],
    ["a change set that is null", { changeSet: "null" }],
    ["a change set from before candidates were frozen", { changeSet: stored(base, changes).changeSet.replace('"version":2', '"version":1') }],
    ["an edited diff", { diff: stored(base, changes).diff.replace("+line 6", "+evil 6") }],
    ["a truncated diff", { diff: stored(base, changes).diff.split("\n").slice(0, -3).join("\n") }],
    ["an empty diff", { diff: "" }],
    ["a diff missing a file", { diff: stored(base, changes.slice(0, 1)).diff }],
    ["a diff that is not a diff", { diff: "nonsense\n" }],
  ])("%s", (_name, override) => {
    expect(attempt(override)).toThrow(ProposalPatchError);
  });
});

import { describe, expect, it } from "vitest";

import {
  CandidateIntegrityError,
  applyCandidateDiff,
  assertCandidateIntegrity,
  buildDeterministicDiff,
  candidateDigestMatches,
  freezeCandidate,
  sha256Hex,
  type BaseTree,
} from "@/lib/agent/candidate";

function tree(entries: Record<string, string>): BaseTree {
  return new Map(Object.entries(entries));
}

const BASE_SHA = "a".repeat(40);

describe("freezing a candidate", () => {
  it("sorts files and deletions so the digest does not depend on capture order", () => {
    const forward = freezeCandidate({
      baseSha: BASE_SHA,
      changes: [
        { path: "src/b.ts", content: "b" },
        { path: "src/a.ts", content: "a" },
        { path: "src/z.ts", content: null },
      ],
    });
    const reversed = freezeCandidate({
      baseSha: BASE_SHA,
      changes: [
        { path: "src/z.ts", content: null },
        { path: "src/a.ts", content: "a" },
        { path: "src/b.ts", content: "b" },
      ],
    });

    expect(forward.files.map((file) => file.path)).toEqual(["src/a.ts", "src/b.ts"]);
    expect(forward.candidateSha256).toBe(reversed.candidateSha256);
  });

  it("hashes each file's exact bytes", () => {
    const candidate = freezeCandidate({
      baseSha: BASE_SHA,
      changes: [{ path: "src/a.ts", content: "export const value = 1;\n" }],
    });

    expect(candidate.files[0].sha256).toBe(sha256Hex("export const value = 1;\n"));
    expect(candidateDigestMatches(candidate)).toBe(true);
  });

  it.each([
    ["a changed byte", [{ path: "src/a.ts", content: "a!" }]],
    ["a renamed path", [{ path: "src/other.ts", content: "a" }]],
    ["an added deletion", [{ path: "src/a.ts", content: "a" }, { path: "src/gone.ts", content: null }]],
  ])("changes the digest for %s", (_label, changes) => {
    const original = freezeCandidate({
      baseSha: BASE_SHA,
      changes: [{ path: "src/a.ts", content: "a" }],
    });
    const modified = freezeCandidate({ baseSha: BASE_SHA, changes });

    expect(modified.candidateSha256).not.toBe(original.candidateSha256);
  });

  it("changes the digest when the base revision changes", () => {
    const changes = [{ path: "src/a.ts", content: "a" }];
    const first = freezeCandidate({ baseSha: BASE_SHA, changes });
    const second = freezeCandidate({ baseSha: "b".repeat(40), changes });

    expect(first.candidateSha256).not.toBe(second.candidateSha256);
  });

  it("rejects a duplicated path rather than letting iteration order decide", () => {
    expect(() =>
      freezeCandidate({
        baseSha: BASE_SHA,
        changes: [
          { path: "src/a.ts", content: "first" },
          { path: "src/a.ts", content: "second" },
        ],
      }),
    ).toThrow("Duplicate path in candidate: src/a.ts");
  });

  it("rejects a path that escapes the repository", () => {
    expect(() =>
      freezeCandidate({ baseSha: BASE_SHA, changes: [{ path: "../.env", content: "x" }] }),
    ).toThrow("Path must stay inside the repository");
  });

  it("requires a trusted base revision", () => {
    expect(() => freezeCandidate({ baseSha: "  ", changes: [] })).toThrow(
      "Frozen candidate requires a trusted base revision",
    );
  });
});

describe("deterministic diff round trip", () => {
  it("reconstructs a modified file", () => {
    const base = tree({ "src/a.ts": "one\ntwo\nthree\n" });
    const candidate = freezeCandidate({
      baseSha: BASE_SHA,
      changes: [{ path: "src/a.ts", content: "one\nTWO\nthree\n" }],
    });

    const diff = buildDeterministicDiff(base, candidate);

    expect(diff).toContain("-two");
    expect(diff).toContain("+TWO");
    expect(applyCandidateDiff(base, diff).files.get("src/a.ts")).toBe("one\nTWO\nthree\n");
  });

  it("reconstructs an added file", () => {
    const base = tree({});
    const candidate = freezeCandidate({
      baseSha: BASE_SHA,
      changes: [{ path: "src/new.ts", content: "fresh\n" }],
    });

    const diff = buildDeterministicDiff(base, candidate);

    expect(diff).toContain("--- /dev/null");
    expect(applyCandidateDiff(base, diff).files.get("src/new.ts")).toBe("fresh\n");
  });

  it("reconstructs a deleted file", () => {
    const base = tree({ "src/old.ts": "gone\n" });
    const candidate = freezeCandidate({
      baseSha: BASE_SHA,
      changes: [{ path: "src/old.ts", content: null }],
    });

    const diff = buildDeterministicDiff(base, candidate);

    expect(diff).toContain("+++ /dev/null");
    expect(applyCandidateDiff(base, diff).deletedPaths.has("src/old.ts")).toBe(true);
  });

  it("is a pure function of its inputs", () => {
    const base = tree({ "src/a.ts": "one\ntwo\n" });
    const candidate = freezeCandidate({
      baseSha: BASE_SHA,
      changes: [{ path: "src/a.ts", content: "one\ntwo!\n" }],
    });

    expect(buildDeterministicDiff(base, candidate)).toBe(buildDeterministicDiff(base, candidate));
  });

  // Deterministic pseudo-random content: apply must invert build for arbitrary
  // edits, not only the shapes chosen by hand above.
  it("round-trips arbitrary edits", () => {
    let seed = 12345;
    const next = (bound: number) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed % bound;
    };

    for (let iteration = 0; iteration < 300; iteration += 1) {
      const beforeLines = Array.from({ length: next(12) }, () => `line-${next(5)}`);
      const afterLines = Array.from({ length: next(12) }, () => `line-${next(5)}`);
      const before = beforeLines.join("\n");
      const after = afterLines.join("\n");
      if (before === after) continue;

      const base = tree({ "src/a.ts": before });
      const candidate = freezeCandidate({
        baseSha: BASE_SHA,
        changes: [{ path: "src/a.ts", content: after }],
      });
      const diff = buildDeterministicDiff(base, candidate);

      expect(applyCandidateDiff(base, diff).files.get("src/a.ts")).toBe(after);
      expect(() => assertCandidateIntegrity({ base, diff, candidate })).not.toThrow();
    }
  });
});

describe("candidate integrity invariant", () => {
  it("accepts a diff genuinely derived from the candidate", () => {
    const base = tree({ "src/a.ts": "safe\n", "src/b.ts": "keep\n" });
    const candidate = freezeCandidate({
      baseSha: BASE_SHA,
      changes: [{ path: "src/a.ts", content: "safer\n" }],
    });
    const diff = buildDeterministicDiff(base, candidate);

    expect(() => assertCandidateIntegrity({ base, diff, candidate })).not.toThrow();
  });

  // R1, the attack the review describes. Verification rewrites the working
  // tree so the human-visible diff shows only an innocuous edit while the
  // captured change set still carries the malicious payload.
  it("rejects a diff that hides what the candidate actually contains", () => {
    const base = tree({ "src/auth.ts": "const admin = false;\n" });

    // What the reviewer would be shown: a harmless comment.
    const innocuous = freezeCandidate({
      baseSha: BASE_SHA,
      changes: [{ path: "src/auth.ts", content: "const admin = false;\n// tidy up\n" }],
    });
    const misleadingDiff = buildDeterministicDiff(base, innocuous);

    // What would actually be delivered.
    const malicious = freezeCandidate({
      baseSha: BASE_SHA,
      changes: [{ path: "src/auth.ts", content: "const admin = true;\n// tidy up\n" }],
    });

    expect(() =>
      assertCandidateIntegrity({ base, diff: misleadingDiff, candidate: malicious }),
    ).toThrow(CandidateIntegrityError);
    expect(() =>
      assertCandidateIntegrity({ base, diff: misleadingDiff, candidate: malicious }),
    ).toThrow(/does not reproduce src\/auth\.ts/);
  });

  it("rejects a candidate whose stored digest was tampered with", () => {
    const base = tree({ "src/a.ts": "safe\n" });
    const candidate = freezeCandidate({
      baseSha: BASE_SHA,
      changes: [{ path: "src/a.ts", content: "safer\n" }],
    });
    const diff = buildDeterministicDiff(base, candidate);
    const forged = { ...candidate, candidateSha256: "0".repeat(64) };

    expect(() => assertCandidateIntegrity({ base, diff, candidate: forged })).toThrow(
      "Frozen candidate digest does not match its contents",
    );
  });

  it("rejects a diff carrying a file the candidate does not contain", () => {
    const base = tree({ "src/a.ts": "safe\n", "src/b.ts": "safe\n" });
    const candidate = freezeCandidate({
      baseSha: BASE_SHA,
      changes: [{ path: "src/a.ts", content: "safer\n" }],
    });
    const extra = freezeCandidate({
      baseSha: BASE_SHA,
      changes: [
        { path: "src/a.ts", content: "safer\n" },
        { path: "src/b.ts", content: "smuggled\n" },
      ],
    });

    expect(() =>
      assertCandidateIntegrity({
        base,
        diff: buildDeterministicDiff(base, extra),
        candidate,
      }),
    ).toThrow(CandidateIntegrityError);
  });

  it("rejects a diff whose removal block does not match the trusted base", () => {
    const base = tree({ "src/a.ts": "actual\n" });
    const pretendBase = tree({ "src/a.ts": "pretend\n" });
    const candidate = freezeCandidate({
      baseSha: BASE_SHA,
      changes: [{ path: "src/a.ts", content: "changed\n" }],
    });
    // Built against a tree that is not the one being verified against.
    const diff = buildDeterministicDiff(pretendBase, candidate);

    expect(() => assertCandidateIntegrity({ base, diff, candidate })).toThrow(
      /Diff context does not match the trusted base/,
    );
  });

  it("rejects a diff that touches a path outside the repository", () => {
    const base = tree({});
    const hostile = [
      "diff --git a/../.env b/../.env",
      "--- /dev/null",
      "+++ b/../.env",
      "@@ -1,0 +1,1 @@",
      "+STOLEN=1",
      "",
    ].join("\n");

    expect(() => applyCandidateDiff(base, hostile)).toThrow(
      "Path must stay inside the repository",
    );
  });

  it("rejects a diff whose header disagrees with its own paths", () => {
    const base = tree({ "src/a.ts": "safe\n" });
    const forged = [
      "diff --git a/src/a.ts b/src/a.ts",
      "--- a/src/a.ts",
      "+++ b/src/evil.ts",
      "@@ -1,1 +1,1 @@",
      "-safe",
      "+evil",
      "",
    ].join("\n");

    expect(() => applyCandidateDiff(base, forged)).toThrow(/does not agree with its paths/);
  });
});

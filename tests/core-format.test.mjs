import { describe, expect, it } from "vitest";
import { formatResult } from "../bin/core.mjs";

/**
 * The rendered text is what an MCP client receives - bin/mcp.mjs returns
 * formatResult() as its only content block. Every path in it has to be openable
 * from the repo root, or the agent has to guess the source root before it can
 * read a single file.
 */
describe("formatResult path rendering", () => {
  const matched = {
    task: "fix the chart",
    widened: false,
    reason: "matched components/Chart.tsx",
    anchors: ["components/Chart.tsx"],
    anchorPaths: ["src/components/Chart.tsx"],
    slice: [
      { path: "src/components/Chart.tsx", rel: "components/Chart.tsx", dist: 0, tokens: 100, recent: true },
      { path: "src/lib/format.ts", rel: "lib/format.ts", dist: 1, tokens: 50, recent: false },
    ],
    excluded: ["lib/unused.ts"],
    sliceTokens: 150,
    totalTokens: 600,
    savedPct: 75,
    refinement: null,
  };

  it("renders anchors as repo-relative paths", () => {
    expect(formatResult(matched)).toContain("Anchor: src/components/Chart.tsx");
  });

  it("renders every slice entry as a repo-relative path", () => {
    const text = formatResult(matched);
    expect(text).toContain("  src/components/Chart.tsx  (dist 0, ~100 tok)  [changed]");
    expect(text).toContain("  src/lib/format.ts  (dist 1, ~50 tok)");
  });

  it("never emits a source-root-relative path on its own line", () => {
    for (const line of formatResult(matched).split("\n")) {
      const entry = line.match(/^ {2}(\S+) {2}\(dist/);
      if (entry) expect(entry[1].startsWith("src/")).toBe(true);
    }
  });

  it("falls back to anchors when anchorPaths is absent", () => {
    const { anchorPaths, ...legacy } = matched;
    expect(formatResult(legacy)).toContain("Anchor: components/Chart.tsx");
  });

  it("renders widened refinement candidates as repo-relative paths", () => {
    const widened = {
      ...matched,
      widened: true,
      reason: "no file matched with enough confidence",
      anchors: [],
      anchorPaths: [],
      refinement: {
        unmatchedTerms: ["chart"],
        candidateFiles: ["components/Chart.tsx"],
        candidateFilePaths: ["src/components/Chart.tsx"],
        repositoryTerms: [],
      },
    };
    expect(formatResult(widened)).toContain("Possible starting files: src/components/Chart.tsx");
  });

  it("falls back to candidateFiles when candidateFilePaths is absent", () => {
    const widened = {
      ...matched,
      widened: true,
      reason: "widened",
      anchors: [],
      refinement: {
        unmatchedTerms: [],
        candidateFiles: ["components/Chart.tsx"],
        repositoryTerms: [],
      },
    };
    expect(formatResult(widened)).toContain("Possible starting files: components/Chart.tsx");
  });
});

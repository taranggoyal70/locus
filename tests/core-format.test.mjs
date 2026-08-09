import { describe, expect, it } from "vitest";
import { buildGraph, buildPackedContext, formatResult, locate } from "../bin/core.mjs";

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
    const entries = formatResult(matched)
      .split("\n")
      .map((line) => line.match(/^ {2}(\S+) {2}\(dist/))
      .filter(Boolean);
    expect(entries).toHaveLength(matched.slice.length);
    for (const entry of entries) expect(entry[1].startsWith("src/")).toBe(true);
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

/**
 * End-to-end over the real producer: locate() has to emit the repo-relative
 * paths that formatResult() and buildPackedContext() render. Hand-built result
 * literals can't catch the producer dropping anchorPaths/candidateFilePaths,
 * because the renderers fall back to the source-root-relative fields.
 */
describe("locate + render on a repo with a src/ root", () => {
  const repo = {
    name: "fixture",
    slug: "fixture",
    description: "fixture repo",
    root: "src",
    recentlyChanged: [],
    files: {
      "src/components/Chart.tsx":
        'import { formatValue } from "../lib/format";\nexport function Chart() {\n  return formatValue(1);\n}\n',
      "src/lib/format.ts":
        "export function formatValue(n: number) {\n  return n.toFixed(2);\n}\nexport const currency = \"USD\";\n",
      "src/lib/unrelated.ts": "export const unrelated = true;\n",
    },
  };
  const graph = buildGraph(repo);

  it("renders anchor and slice as paths that exist in repo.files", () => {
    const result = locate("fix the chart", repo, graph);
    expect(result.widened).toBe(false);
    const text = formatResult(result);
    expect(text).toContain("Anchor: src/components/Chart.tsx");
    const entries = text
      .split("\n")
      .map((line) => line.match(/^ {2}(\S+) {2}\(dist/))
      .filter(Boolean);
    expect(entries).toHaveLength(result.slice.length);
    for (const entry of entries) expect(repo.files[entry[1]]).toBeDefined();
  });

  it("renders widened candidates as paths that exist in repo.files", () => {
    const result = locate("currency rounding", repo, graph);
    expect(result.widened).toBe(true);
    expect(result.refinement.candidateFilePaths.length).toBeGreaterThan(0);
    for (const candidate of result.refinement.candidateFilePaths) {
      expect(repo.files[candidate]).toBeDefined();
    }
    expect(formatResult(result)).toContain(
      `Possible starting files: ${result.refinement.candidateFilePaths.join(", ")}`,
    );
  });

  it("labels packed and omitted files with paths that exist in repo.files", () => {
    const result = locate("fix the chart", repo, graph);
    const packed = buildPackedContext(result, repo, 1);
    expect(packed.included).toHaveLength(1);
    expect(packed.dropped.length).toBeGreaterThan(0);
    const headers = [...packed.text.matchAll(/^===== (\S+) =====$/gm)].map((m) => m[1]);
    expect(headers).toEqual(packed.included.map((f) => f.path));
    for (const label of [...headers, ...packed.dropped]) {
      expect(repo.files[label]).toBeDefined();
    }
    expect(packed.text).toContain(`tokens: ${packed.dropped.join(", ")}`);
  });
});

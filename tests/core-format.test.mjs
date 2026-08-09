import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { buildGraph, buildPackedContext, formatResult, loadLocalRepo, locate } from "../bin/core.mjs";

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
    reason: "matched src/components/Chart.tsx",
    anchors: ["components/Chart.tsx"],
    anchorPaths: ["src/components/Chart.tsx"],
    slice: [
      { path: "src/components/Chart.tsx", rel: "components/Chart.tsx", dist: 0, tokens: 100, recent: true },
      { path: "src/lib/format.ts", rel: "lib/format.ts", dist: 1, tokens: 50, recent: false },
    ],
    excluded: ["lib/unused.ts"],
    excludedPaths: ["src/lib/unused.ts"],
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

  it("omits the repo header when no analyzed directory is supplied", () => {
    expect(formatResult(matched).split("\n")[0]).toBe("Anchor: src/components/Chart.tsx");
  });
});

/**
 * End-to-end over the real producer: locate() has to emit the repo-relative
 * paths that formatResult() and buildPackedContext() render. Hand-built result
 * literals can't catch the producer dropping anchorPaths/candidateFilePaths.
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

  it("names anchors and excluded files with paths that exist in repo.files", () => {
    const result = locate("fix the chart", repo, graph);
    expect(result.excludedPaths.length).toBeGreaterThan(0);
    expect(result.excludedPaths).toHaveLength(result.excluded.length);
    for (const excluded of result.excludedPaths) expect(repo.files[excluded]).toBeDefined();
    for (const anchor of result.anchorPaths) {
      expect(repo.files[anchor]).toBeDefined();
      expect(result.reason).toContain(anchor);
    }
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

/**
 * The rendered paths are relative to the analyzed directory, which is not
 * necessarily the reader's cwd: `locus locate --path <dir>` and the MCP
 * `locate({path})` argument both analyze somewhere else. Unless the output
 * names that directory, an agent resolving the paths against its own cwd gets
 * ENOENT - or a same-named file in the wrong repo.
 */
describe("rendering a repo analyzed from another directory", () => {
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "locus-render-"));
  const analyzed = path.join(workdir, "api");
  fs.mkdirSync(path.join(analyzed, "src", "lib"), { recursive: true });
  fs.writeFileSync(
    path.join(analyzed, "src", "lib", "sources.ts"),
    'import { parse } from "./parse";\nexport function loadSources() {\n  return parse("sources");\n}\n',
  );
  fs.writeFileSync(
    path.join(analyzed, "src", "lib", "parse.ts"),
    "export function parse(input: string) {\n  return input.trim();\n}\n",
  );
  // A decoy of the same source-root-relative name in a sibling repo: resolving
  // "lib/sources.ts" from here silently reads the wrong file.
  const other = path.join(workdir, "web");
  fs.mkdirSync(path.join(other, "lib"), { recursive: true });
  fs.writeFileSync(path.join(other, "lib", "sources.ts"), "export const wrongRepo = true;\n");

  afterAll(() => fs.rmSync(workdir, { recursive: true, force: true }));

  const repo = loadLocalRepo(analyzed);
  const graph = buildGraph(repo);
  const result = locate("load sources", repo, graph);

  it("states the analyzed directory before any path", () => {
    const lines = formatResult(result, repo).split("\n");
    expect(lines[0]).toBe(`Repo: ${analyzed}  (paths below are relative to this directory)`);
  });

  it("renders slice paths that resolve to real files under the stated directory", () => {
    const text = formatResult(result, repo);
    const entries = text
      .split("\n")
      .map((line) => line.match(/^ {2}(\S+) {2}\(dist/))
      .filter(Boolean);
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(fs.existsSync(path.join(analyzed, entry[1]))).toBe(true);
      // The same path resolved against the reader's own repo does not exist.
      expect(fs.existsSync(path.join(other, entry[1]))).toBe(false);
    }
  });

  it("states the analyzed directory in the packed context header", () => {
    const packed = buildPackedContext(result, repo, 40000);
    expect(packed.text.split("\n")[1]).toBe(
      `# Repo: ${analyzed}  (file paths below are relative to this directory)`,
    );
    const headers = [...packed.text.matchAll(/^===== (\S+) =====$/gm)].map((m) => m[1]);
    expect(headers.length).toBeGreaterThan(0);
    for (const header of headers) {
      expect(fs.existsSync(path.join(analyzed, header))).toBe(true);
    }
  });
});

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  buildGraph,
  buildJsonResult,
  buildPackedContext,
  formatResult,
  loadLocalRepo,
  locate,
} from "../bin/core.mjs";

/**
 * The rendered text is what an MCP client receives - bin/mcp.mjs returns
 * formatResult() as its only content block. Every path in it has to be openable
 * from the repo root, or the agent has to guess the source root before it can
 * read a single file.
 */
describe("formatResult path rendering", () => {
  const repo = { dir: "/home/me/work/api", files: {} };
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
    expect(formatResult(matched, repo)).toContain("Anchor: src/components/Chart.tsx");
  });

  it("renders every slice entry as a repo-relative path", () => {
    const text = formatResult(matched, repo);
    expect(text).toContain("  src/components/Chart.tsx  (dist 0, ~100 tok)  [changed]");
    expect(text).toContain("  src/lib/format.ts  (dist 1, ~50 tok)");
  });

  it("never emits a source-root-relative path on its own line", () => {
    const entries = formatResult(matched, repo)
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
    expect(formatResult(widened, repo)).toContain("Possible starting files: src/components/Chart.tsx");
  });
});

/**
 * No output surface may emit a path without naming the directory it is
 * relative to, so each one refuses to render rather than producing a block an
 * agent would resolve against the wrong repo.
 */
describe("every surface refuses to render an unanchored result", () => {
  const result = {
    task: "t",
    widened: false,
    reason: "matched src/a.ts",
    anchors: ["a.ts"],
    anchorPaths: ["src/a.ts"],
    slice: [{ path: "src/a.ts", rel: "a.ts", dist: 0, tokens: 10, recent: false }],
    excluded: [],
    excludedPaths: [],
    sliceTokens: 10,
    totalTokens: 10,
    savedPct: 0,
    refinement: null,
  };

  for (const [surface, render] of [
    ["formatResult", (repo) => formatResult(result, repo)],
    ["buildPackedContext", (repo) => buildPackedContext(result, repo, 40000)],
    ["buildJsonResult", (repo) => buildJsonResult(result, repo)],
  ]) {
    it(`${surface} throws when the repo is missing`, () => {
      expect(() => render(undefined)).toThrow(/loadLocalRepo/);
    });

    it(`${surface} throws when the repo has no analyzed dir`, () => {
      expect(() => render({ files: { "src/a.ts": "" } })).toThrow(/loadLocalRepo/);
    });
  }
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
    dir: "/home/me/work/fixture",
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
    const text = formatResult(result, repo);
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
    expect(formatResult(result, repo)).toContain(
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
 * The emitted paths are relative to the analyzed directory, which is not
 * necessarily the reader's cwd: `locus locate --path <dir>` and the MCP
 * `locate({path})` argument both analyze somewhere else. Unless the output
 * names that directory, an agent resolving the paths against its own cwd gets
 * ENOENT - or a same-named file in the wrong repo.
 *
 * The fixture makes that second case concrete. Its source root is `src`, so
 * the source-root-relative spelling of the anchor is `lib/sources.ts`, and a
 * sibling repo really does hold a `lib/sources.ts`. Emitting the pre-fix
 * spelling would therefore resolve - to the wrong file.
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
  // Holds the source root at `src` rather than `src/lib`, so `rel` stays
  // `lib/sources.ts` and the decoy below is a spelling the code can emit.
  fs.writeFileSync(path.join(analyzed, "src", "version.ts"), 'export const version = "0.0.0";\n');

  const other = path.join(workdir, "web");
  fs.mkdirSync(path.join(other, "lib"), { recursive: true });
  fs.writeFileSync(path.join(other, "lib", "sources.ts"), "export const wrongRepo = true;\n");

  afterAll(() => fs.rmSync(workdir, { recursive: true, force: true }));

  const repo = loadLocalRepo(analyzed);
  const graph = buildGraph(repo);
  const result = locate("load sources", repo, graph);

  it("keeps a source-root-relative spelling that collides with the sibling repo", () => {
    expect(repo.root).toBe("src");
    const anchorRel = graph.byPath[result.anchorPaths[0]].rel;
    expect(anchorRel).toBe("lib/sources.ts");
    expect(fs.existsSync(path.join(other, anchorRel))).toBe(true);
  });

  it("states the analyzed directory before any path", () => {
    const lines = formatResult(result, repo).split("\n");
    expect(lines[0]).toBe(`Repo: ${analyzed}  (paths below are relative to this directory)`);
  });

  const renderedSlicePaths = () =>
    formatResult(result, repo)
      .split("\n")
      .map((line) => line.match(/^ {2}(\S+) {2}\(dist/))
      .filter(Boolean)
      .map((entry) => entry[1]);

  it("renders slice paths that resolve to real files under the stated directory", () => {
    const paths = renderedSlicePaths();
    expect(paths.length).toBeGreaterThan(0);
    for (const p of paths) expect(fs.existsSync(path.join(analyzed, p))).toBe(true);
  });

  it("renders no path that would silently resolve inside the sibling repo", () => {
    const paths = renderedSlicePaths();
    expect(paths.length).toBeGreaterThan(0);
    for (const p of paths) expect(fs.existsSync(path.join(other, p))).toBe(false);
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

  it("states the analyzed directory in the machine-readable result", () => {
    const json = JSON.parse(JSON.stringify(buildJsonResult(result, repo)));
    expect(json.dir).toBe(analyzed);
    const paths = [
      ...json.slice.map((f) => f.path),
      ...json.slice.map((f) => f.rel),
      ...json.anchors,
      ...json.anchorPaths,
      ...json.excluded,
      ...json.excludedPaths,
    ];
    expect(paths.length).toBeGreaterThan(0);
    for (const p of paths) expect(fs.existsSync(path.join(json.dir, p))).toBe(true);
  });

  it("normalizes legacy JSON path fields to repo-relative paths", () => {
    const json = buildJsonResult(result, repo);
    expect(json.dir).toBe(analyzed);
    expect(json.anchors).toEqual(result.anchorPaths);
    expect(json.excluded).toEqual(result.excludedPaths);
    expect(json.slice.map((f) => f.rel)).toEqual(result.slice.map((f) => f.path));
  });

  it("normalizes widened JSON candidates to repo-relative paths", () => {
    const widened = locate("trim cleanup", repo, graph);
    expect(widened.widened).toBe(true);
    const json = buildJsonResult(widened, repo);
    expect(json.refinement.candidateFiles).toEqual(widened.refinement.candidateFilePaths);
    for (const candidate of json.refinement.candidateFiles) {
      expect(fs.existsSync(path.join(json.dir, candidate))).toBe(true);
    }
  });
});

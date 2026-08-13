import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { buildGraph as buildGraphCli, locate as locateCli } from "../bin/core.mjs";
import { buildGraph as buildGraphWeb, locate as locateWeb } from "../src/lib/localizer.ts";

/**
 * `bin/core.mjs` declares itself a faithful port of `src/lib/localizer.ts`, but
 * `pnpm check-sync` only diffs `bin/` against `cli/` - it never compares either
 * against the original. The two did drift: the CLI gained `anchorPaths`,
 * `excludedPaths` and `candidateFilePaths` while the web/API implementation kept
 * emitting only the source-root-relative spellings, so the same repository was
 * described two ways depending on which surface you asked.
 *
 * This asserts the contract the header claims, on the same input, so the next
 * drift fails here instead of shipping to one surface.
 */
const repo = JSON.parse(readFileSync("test/fixtures/studentpulse.json", "utf8"));

function keysOf(value) {
  return Object.keys(value).sort();
}

describe("CLI/web localizer parity", () => {
  const cases = [
    { label: "anchored task", task: "the dashboard chart is broken" },
    { label: "widened task", task: "make the checkout flow faster" },
    { label: "vague task", task: "help me" },
  ];

  for (const { label, task } of cases) {
    it(`returns the same result shape for an ${label}`, () => {
      const web = locateWeb(task, repo, buildGraphWeb(repo));
      const cli = locateCli(task, repo, buildGraphCli(repo));

      expect(keysOf(cli)).toEqual(keysOf(web));
      expect(keysOf(cli.slice[0])).toEqual(keysOf(web.slice[0]));
      if (web.refinement) expect(keysOf(cli.refinement)).toEqual(keysOf(web.refinement));
    });

    it(`agrees on which files it selected for an ${label}`, () => {
      const web = locateWeb(task, repo, buildGraphWeb(repo));
      const cli = locateCli(task, repo, buildGraphCli(repo));

      // Anchoring, widening and ranking are the ported behavior the header says
      // must not change on one side only.
      expect(cli.widened).toBe(web.widened);
      expect(cli.anchorPaths).toEqual(web.anchorPaths);
      expect(cli.excludedPaths).toEqual(web.excludedPaths);
      expect(cli.slice.map((f) => f.path)).toEqual(web.slice.map((f) => f.path));
      expect(cli.savedPct).toBe(web.savedPct);
    });
  }
});

/**
 * The agent Run path ingests `json|css|scss|md` alongside source, unlike the web
 * and CLI paths which filter to JS/TS first. That made an edge to a non-node
 * reachable, and `locate` dereferenced `byPath[p].rel` on it. Both
 * implementations must survive it identically.
 */
describe("non-source imports", () => {
  const cssRepo = {
    name: "css", slug: "css", description: "", root: "src",
    recentlyChanged: [],
    files: {
      "src/app/dashboard/page.tsx":
        'import styles from "./Dashboard.module.css";\nimport cfg from "./config.json";\nimport { fmt } from "@/lib/date";\nexport default function P(){return null;}',
      "src/app/dashboard/Dashboard.module.css": ".root{color:red}",
      "src/app/dashboard/config.json": '{"a":1}',
      "src/lib/date.ts": "export const fmt = (d) => String(d);",
    },
  };

  it("does not crash on a CSS module or JSON import", () => {
    for (const [label, build, run] of [
      ["web", buildGraphWeb, locateWeb],
      ["cli", buildGraphCli, locateCli],
    ]) {
      const graph = build(cssRepo);
      expect(() => run("fix the dashboard", cssRepo, graph), label).not.toThrow();
    }
  });

  it("keeps only edges whose endpoint is a graph node", () => {
    for (const [label, build] of [["web", buildGraphWeb], ["cli", buildGraphCli]]) {
      const graph = build(cssRepo);
      const nodePaths = new Set(graph.nodes.map((n) => n.path));
      for (const edge of graph.edges) {
        expect(nodePaths.has(edge.to), `${label}: edge to ${edge.to}`).toBe(true);
        expect(nodePaths.has(edge.from), `${label}: edge from ${edge.from}`).toBe(true);
      }
      // The real dependency is still found; only the non-source edge is dropped.
      expect(graph.edges.map((e) => e.to), label).toContain("src/lib/date.ts");
    }
  });

  it("agrees on the slice for a repo containing non-source files", () => {
    const web = locateWeb("fix the dashboard", cssRepo, buildGraphWeb(cssRepo));
    const cli = locateCli("fix the dashboard", cssRepo, buildGraphCli(cssRepo));

    expect(cli.slice.map((f) => f.path)).toEqual(web.slice.map((f) => f.path));
    expect(cli.anchorPaths).toEqual(web.anchorPaths);
    // A non-source file must never appear in a slice that feeds a coding agent.
    expect(web.slice.map((f) => f.path)).not.toContain("src/app/dashboard/Dashboard.module.css");
  });
});

/**
 * The sparsity signal existed only in the web UI, computed inline in a React
 * component, while the CLI, MCP server and REST API — the surfaces that feed an
 * agent with no human looking at the graph — reported the inflated saving with no
 * warning at all. One definition now, asserted on both implementations.
 */
describe("sparsity signal", () => {
  const sparseRepo = {
    name: "sparse", slug: "sparse", description: "", root: "src",
    recentlyChanged: [],
    files: {
      // NodeNext-style specifiers this parser cannot resolve: 0 edges, so the
      // slice looks small for the wrong reason.
      "src/dashboard.ts": 'import { fmt } from "./date.js";\nexport const dash = fmt;',
      "src/date.ts": "export const fmt = (d) => String(d);",
      "src/unrelated.ts": "export const other = 1;",
    },
  };
  const denseRepo = {
    name: "dense", slug: "dense", description: "", root: "src",
    recentlyChanged: [],
    files: {
      "src/dashboard.ts": 'import { fmt } from "@/date";\nimport { chart } from "@/chart";\nexport const dash = [fmt, chart];',
      "src/date.ts": 'import { pad } from "@/pad";\nexport const fmt = pad;',
      "src/chart.ts": 'import { pad } from "@/pad";\nexport const chart = pad;',
      "src/pad.ts": "export const pad = 1;",
    },
  };

  it("flags a repo whose imports did not resolve", () => {
    for (const [label, build, run] of [["web", buildGraphWeb, locateWeb], ["cli", buildGraphCli, locateCli]]) {
      const result = run("fix the dashboard", sparseRepo, build(sparseRepo));
      expect(result.sparse, label).toBe(true);
      expect(result.edgeDensity, label).toBe(0);
    }
  });

  it("does not flag a repo whose imports resolved", () => {
    for (const [label, build, run] of [["web", buildGraphWeb, locateWeb], ["cli", buildGraphCli, locateCli]]) {
      const result = run("fix the dashboard", denseRepo, build(denseRepo));
      expect(result.sparse, label).toBe(false);
      expect(result.edgeDensity, label).toBeGreaterThan(0.6);
    }
  });

  it("agrees on the signal across both implementations", () => {
    for (const repo of [sparseRepo, denseRepo]) {
      const web = locateWeb("fix the dashboard", repo, buildGraphWeb(repo));
      const cli = locateCli("fix the dashboard", repo, buildGraphCli(repo));
      expect(cli.sparse).toBe(web.sparse);
      expect(cli.edgeDensity).toBe(web.edgeDensity);
    }
  });
});

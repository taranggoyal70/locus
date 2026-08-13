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

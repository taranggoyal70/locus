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

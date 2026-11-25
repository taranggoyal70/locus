import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import recorded from "@/lib/landing-orbits.json";
import { RECORDED_SLICE } from "@/lib/landing-slice";
import { buildGraph, locate } from "@/lib/localizer";
import type { RepoData } from "@/lib/types";

const repo = JSON.parse(
  readFileSync(new URL("../../public/repos/taxonomy.json", import.meta.url), "utf8"),
) as RepoData;

/** The tasks the Locus figure replays: three that localize, one that Widens. */
const TASKS = [
  RECORDED_SLICE.task,
  "the stripe webhook drops events",
  "fix the dashboard billing",
  "kubernetes helm chart rollback",
];

function record() {
  const graph = buildGraph(repo);
  const files = RECORDED_SLICE.files as readonly string[];
  return TASKS.map((task) => {
    const result = locate(task, repo, graph);
    const inSlice = new Set(result.slice.map(({ path }) => path));
    return {
      task,
      widened: result.widened,
      sliceTokens: result.sliceTokens,
      totalTokens: result.totalTokens,
      // [index into RECORDED_SLICE.files, hops from an Anchor], ranked as the localizer ranks them.
      slice: result.widened ? [] : result.slice.map(({ path, dist }) => [files.indexOf(path), dist]),
      anchors: result.widened ? [] : result.anchorPaths.map((path) => files.indexOf(path)),
      // Imports between two Slice files, importer first.
      edges: result.widened
        ? []
        : graph.edges
            .filter(({ from, to }) => inSlice.has(from) && inSlice.has(to))
            .map(({ from, to }) => [files.indexOf(from), files.indexOf(to)]),
    };
  });
}

describe("the Locus figure's recorded localizations", () => {
  it("are still what the localizer returns", () => {
    // UPDATE_ORBITS=1 pnpm test src/lib/landing-orbits.test.ts re-records them.
    if (process.env.UPDATE_ORBITS) {
      writeFileSync(new URL("./landing-orbits.json", import.meta.url), `${JSON.stringify(record())}\n`);
      return;
    }
    expect(recorded).toEqual(record());
  });

  it("show three Slices and one Widen", () => {
    expect(recorded.map(({ widened }) => widened)).toEqual([false, false, false, true]);
    for (const { slice, anchors } of recorded) for (const anchor of anchors) expect(slice.some(([file]) => file === anchor)).toBe(true);
  });
});

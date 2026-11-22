import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { repoMapColumns, RECORDED_RESULT, RECORDED_SLICE } from "@/lib/landing-slice";
import { buildGraph, locate } from "@/lib/localizer";
import type { RepoData } from "@/lib/types";

const repo = JSON.parse(
  readFileSync(new URL("../../public/repos/taxonomy.json", import.meta.url), "utf8"),
) as RepoData;

describe("the landing page's recorded Slice", () => {
  it("is still what the localizer returns for the recorded task", () => {
    const graph = buildGraph(repo);
    const result = locate(RECORDED_SLICE.task, repo, graph);
    const inSlice = new Set(result.slice.map(({ path }) => path));

    expect(RECORDED_SLICE.files).toEqual(Object.keys(repo.files).sort());
    expect(RECORDED_RESULT).toEqual({
      ...result,
      excluded: [...result.excluded].sort(),
      excludedPaths: [...result.excludedPaths].sort(),
    });
    expect(RECORDED_SLICE.edges).toEqual(
      graph.edges.filter(({ from, to }) => inSlice.has(from) && inSlice.has(to)).map(({ from, to }) => [from, to]),
    );
  });

  it("places every file in exactly one Repo map column", () => {
    const columns = repoMapColumns(RECORDED_SLICE.files);

    expect(columns.map(({ label }) => label)).toEqual(["app", "components", "lib", "other"]);
    expect(columns.flatMap(({ files }) => files).sort()).toEqual([...RECORDED_SLICE.files]);
  });
});

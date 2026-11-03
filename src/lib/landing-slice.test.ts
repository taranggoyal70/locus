import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { apertureColumns, RECORDED_SLICE } from "@/lib/landing-slice";
import { buildGraph, locate } from "@/lib/localizer";
import type { RepoData } from "@/lib/types";

const repo = JSON.parse(
  readFileSync(new URL("../../public/repos/taxonomy.json", import.meta.url), "utf8"),
) as RepoData;

describe("the landing page's recorded Slice", () => {
  it("is still what the localizer returns for the recorded task", () => {
    const result = locate(RECORDED_SLICE.task, repo, buildGraph(repo));

    expect(RECORDED_SLICE.files).toEqual(Object.keys(repo.files).sort());
    expect(RECORDED_SLICE.slice).toEqual(result.slice.map(({ path, dist }) => ({ path, dist })));
    expect(RECORDED_SLICE.anchors).toEqual(result.anchorPaths);
    expect(RECORDED_SLICE.sliceTokens).toBe(result.sliceTokens);
    expect(RECORDED_SLICE.totalTokens).toBe(result.totalTokens);
    expect(RECORDED_SLICE.widened).toBe(result.widened);
  });

  it("places every file in exactly one aperture column", () => {
    const columns = apertureColumns(RECORDED_SLICE.files);

    expect(columns.map(({ label }) => label)).toEqual(["app", "components", "lib", "other"]);
    expect(columns.flatMap(({ files }) => files).sort()).toEqual([...RECORDED_SLICE.files]);
  });
});

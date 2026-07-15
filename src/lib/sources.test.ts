import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import { buildGraph, locate } from "@/lib/localizer";
import { BUNDLED, githubSource } from "@/lib/sources";
import type { RepoData } from "@/lib/types";

// Guards the class of bug where the auto-loaded bundled repo was renamed away
// (useLocus loaded "studentpulse" after it was deleted → 404 on every cold load,
// and no test exercised the load path). Also asserts root inference works well
// enough that Surfaces are discovered — the silent-always-widen failure mode.
describe("bundled demo repos", () => {
  for (const b of BUNDLED) {
    it(`${b.slug}: file exists, builds a graph with surfaces, examples localize`, () => {
      const repo: RepoData = JSON.parse(readFileSync(`public/repos/${b.slug}.json`, "utf8"));
      const graph = buildGraph(repo);
      expect(graph.nodes.length).toBeGreaterThan(0);
      expect(graph.surfaces.length).toBeGreaterThan(0);
      const anchored = b.examples.filter((ex) => !locate(ex, repo, graph).widened);
      expect(anchored.length, `no example anchored for ${b.slug}`).toBeGreaterThan(0);
    });
  }
});

describe("GitHub repository source", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("does not blame repository input when an upstream service fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 502 })));

    await expect(githubSource("owner/repo").load()).rejects.toThrow(
      "GitHub analysis is temporarily unavailable. Please try again.",
    );
  });
});

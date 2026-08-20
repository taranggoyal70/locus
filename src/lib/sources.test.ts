import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import { buildGraph, locate } from "@/lib/localizer";
import { BUNDLED, githubSource, parseRepoData, RepoSourceError } from "@/lib/sources";
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

  it.each([
    { status: 404, apiCode: "unavailable", code: "unavailable", retryable: false },
    { status: 404, apiCode: "invalid", code: "invalid", retryable: false },
    { status: 403, apiCode: "invalid", code: "invalid", retryable: false },
    { status: 429, apiCode: "rate-limited", code: "rate-limited", retryable: true },
    { status: 503, apiCode: "temporary", code: "temporary", retryable: true },
  ] as const)("classifies $status/$apiCode responses for recovery", async ({ status, apiCode, code, retryable }) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(
      { error: "Repo load failed.", code: apiCode },
      { status },
    )));

    const failure = await githubSource("owner/repo").load().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(RepoSourceError);
    expect(failure).toMatchObject({ code, retryable });
  });

  it("does not infer the public-Repo boundary from HTTP status alone", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(
      { error: "Commit or branch was not found." },
      { status: 404 },
    )));

    const failure = await githubSource("owner/repo@missing").load().catch((error: unknown) => error);

    expect(failure).toMatchObject({ code: "invalid", retryable: false });
  });

  it("rejects malformed repository data instead of crashing the localizer", () => {
    expect(() => parseRepoData({ name: "broken", files: null })).toThrow(
      "Repository response was incomplete.",
    );
  });

  it("rejects a successful but incomplete API response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      repo: { name: "owner/repo", slug: "owner-repo", files: {} },
      fileCount: 0,
    })));

    const failure = await githubSource("owner/repo").load().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(RepoSourceError);
    expect(failure).toMatchObject({
      message: "GitHub returned an incomplete Repo response. Please try again.",
      code: "temporary",
      retryable: true,
    });
  });
});

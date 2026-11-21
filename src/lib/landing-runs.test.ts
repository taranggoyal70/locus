import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import record from "@/lib/landing-runs.json";
import { expandRun, loadRecordedRuns, type StoredRun } from "@/lib/landing-runs";
import { RECORDED_RESULT, RECORDED_SLICE } from "@/lib/landing-slice";
import { landingRuns, LANDING_REPO, refinedTask, refinementTerms, SELF_PLAY, TRY_TASKS } from "@/lib/landing-tasks";
import { buildGraph, locate } from "@/lib/localizer";
import type { RepoData } from "@/lib/types";

const repo = JSON.parse(
  readFileSync(new URL("../../public/repos/taxonomy.json", import.meta.url), "utf8"),
) as RepoData;
const stored = record.runs as StoredRun[];
const sortedLeftOut = <T extends { excluded: string[]; excludedPaths: string[] }>(run: T) => ({
  ...run,
  excluded: [...run.excluded].sort(),
  excludedPaths: [...run.excludedPaths].sort(),
});

describe("Fig. 1's recorded runs", () => {
  it("are still what the localizer returns; rerun `pnpm landing:record` if not", () => {
    const graph = buildGraph(repo);
    const fresh = landingRuns((task) => locate(task, repo, graph));

    expect(record.repo).toBe(LANDING_REPO);
    expect(stored.map(({ task }) => task)).toEqual(fresh.map(({ task }) => task));
    expect(stored.map((run) => sortedLeftOut(expandRun(run)))).toEqual(fresh.map(sortedLeftOut));
  });

  it("start from the recorded Slice the server renders and Fig. 2 draws", () => {
    expect(SELF_PLAY[0]).toBe(RECORDED_SLICE.task);
    expect(expandRun(stored[0])).toEqual(RECORDED_RESULT);
  });

  it("answer every button the figure offers, Widened refinements included", async () => {
    const recorded = await loadRecordedRuns();
    const widened = [...SELF_PLAY, ...TRY_TASKS].map((task) => recorded(task)).filter((run) => run?.widened);

    for (const task of [...SELF_PLAY, ...TRY_TASKS]) expect(recorded(task)?.task).toBe(task);
    expect(widened.length).toBeGreaterThan(0);
    for (const run of widened) {
      const terms = refinementTerms(run?.refinement?.repositoryTerms ?? []);
      expect(terms.length).toBeGreaterThan(0);
      for (const term of terms) expect(recorded(refinedTask(run!.task, term))).not.toBeNull();
    }
  });

  it("show the cases the figure is there to show", async () => {
    const recorded = await loadRecordedRuns();
    const pricing = recorded("update the marketing pricing page");
    const helm = recorded("kubernetes helm chart rollback");

    expect(pricing?.widened).toBe(false);
    expect(pricing?.anchorPaths).toContain("app/(marketing)/pricing/page.tsx");
    expect(pricing?.slice.length).toBeLessThan(RECORDED_RESULT.slice.length);
    expect(helm?.widened).toBe(true);
    expect(helm?.slice).toHaveLength(Object.keys(repo.files).length);
    expect(helm?.refinement?.unmatchedTerms).toContain("kubernetes");
  });

  it("look a task up regardless of case and spacing, and know nothing else", async () => {
    const recorded = await loadRecordedRuns();

    expect(recorded("  Update the MARKETING   pricing page ")?.task).toBe("update the marketing pricing page");
    expect(recorded("rewrite the editor in rust")).toBeNull();
  });

  it("keep one spelling of every path, as the bundled Repo has no source root", () => {
    expect(repo.root).toBe("");
    for (const run of stored) for (const file of run.slice) expect(file.rel).toBe(file.path);
  });
});

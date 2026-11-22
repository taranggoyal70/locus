import type { LocateResult, RepoData } from "@/lib/types";

export type LandingEngine = {
  repo: RepoData;
  run: (task: string) => LocateResult;
};

let engine: Promise<LandingEngine> | null = null;

/**
 * The real localizer and the bundled copy of shadcn-ui/taxonomy, in a chunk of
 * their own that loads after the page, once the live figure is near the screen.
 * Every Slice on the landing page is computed in the visitor's tab, and no task
 * leaves it.
 *
 * Imported as a code chunk rather than fetched from /repos on purpose: /repos
 * stays behind sign-in (it also holds a Repo that is not public), and this
 * exposes only this one public Repo to signed-out visitors. It deliberately
 * does not import lib/sources, which lists the other bundled Repos.
 */
export function loadLandingEngine(): Promise<LandingEngine> {
  engine ??= Promise.all([import("@/lib/localizer"), import("../../public/repos/taxonomy.json")])
    .then(([{ buildGraph, locate }, data]) => {
      const repo = data.default as RepoData;
      const graph = buildGraph(repo);
      return { repo, run: (task: string) => locate(task, repo, graph) };
    })
    .catch((error: unknown) => {
      // A failed chunk load must not stick: the next attempt gets a fresh try.
      engine = null;
      throw error;
    });
  return engine;
}

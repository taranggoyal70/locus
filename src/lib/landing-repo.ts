import type { RepoData } from "@/lib/types";

let repo: Promise<RepoData> | null = null;

/**
 * The bundled copy of shadcn-ui/taxonomy, for the source Fig. 1's file panel
 * shows: a chunk of its own that loads after the page, once the figure is near
 * the screen. Only the Repo's files. The Slices are recorded
 * (landing-runs.ts), so the localizer stays off the landing page.
 *
 * Imported as a code chunk rather than fetched from /repos on purpose: /repos
 * stays behind sign-in (it also holds a Repo that is not public), and this
 * exposes only this one public Repo to signed-out visitors. It deliberately
 * does not import lib/sources, which lists the other bundled Repos.
 */
export function loadLandingRepo(): Promise<RepoData> {
  repo ??= import("../../public/repos/taxonomy.json")
    .then((data) => data.default as RepoData)
    .catch((error: unknown) => {
      // A failed chunk load must not stick: the next attempt gets a fresh try.
      repo = null;
      throw error;
    });
  return repo;
}

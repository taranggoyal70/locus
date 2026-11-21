import type { LocateResult } from "@/lib/types";

/**
 * The tasks Fig. 1 can show, and the refinements it offers when one Widens.
 *
 * Fig. 1 replays recorded runs (landing-runs.json) rather than shipping the
 * localizer to signed-out visitors: docs/security/ip-protection.md keeps the
 * ranking, scoring and Closure logic out of every public artifact.
 * `pnpm landing:record` records what landingRuns lists, and
 * landing-runs.test.ts fails when the record drifts from the localizer.
 *
 * Only a type import, so the recording script can load this file as it is.
 */
export const LANDING_REPO = "shadcn-ui/taxonomy";

/** The same limit as POST /api/v1/locate. */
export const MAX_TASK_LENGTH = 1000;

/** What the figure plays by itself before handing over: two tasks, two Slices. */
export const SELF_PLAY = ["the post editor loses changes on save", "update the marketing pricing page"] as const;

/** The tasks offered as buttons once the figure is the visitor's. */
export const TRY_TASKS = ["the stripe webhook drops events", "fix the dashboard billing", "kubernetes helm chart rollback"] as const;

// The Repo's commonest words include file extensions, which refine nothing.
const FILE_EXTENSIONS = new Set(["ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "css", "json", "md", "mdx"]);

/** The words a Widened Slice offers as buttons, to refine the task with. */
export function refinementTerms(repositoryTerms: readonly string[]): string[] {
  return repositoryTerms.filter((term) => !FILE_EXTENSIONS.has(term)).slice(0, 6);
}

export function refinedTask(task: string, term: string): string {
  return `${task} ${term}`.trim().slice(0, MAX_TASK_LENGTH);
}

/** How a task is looked up in the record: case and spacing aside. */
export function taskKey(task: string): string {
  return task.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Every run Fig. 1 can show: each task, and each refinement a Widened one
 * offers, so every button in the figure has a recorded answer.
 */
export function landingRuns(run: (task: string) => LocateResult): LocateResult[] {
  const runs: LocateResult[] = [];
  for (const task of [...SELF_PLAY, ...TRY_TASKS]) {
    const result = run(task);
    runs.push(result);
    if (!result.widened || !result.refinement) continue;
    for (const term of refinementTerms(result.refinement.repositoryTerms)) runs.push(run(refinedTask(task, term)));
  }
  return runs;
}

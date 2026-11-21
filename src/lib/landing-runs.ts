import { RECORDED_SLICE } from "@/lib/landing-slice";
import { taskKey } from "@/lib/landing-tasks";
import type { LocateResult } from "@/lib/types";

/** A run as landing-runs.json keeps it: without the files left out, which follow from the Slice. */
export type StoredRun = Omit<LocateResult, "excluded" | "excludedPaths">;

/**
 * A stored run in the shape the product's panels take. In the bundled copy of
 * shadcn-ui/taxonomy a file's display path is its Repo path (landing-slice.ts),
 * so both spellings of the files left out are the same list.
 */
export function expandRun(run: StoredRun): LocateResult {
  const inSlice = new Set(run.slice.map(({ path }) => path));
  const left = RECORDED_SLICE.files.filter((file) => !inSlice.has(file));
  return { ...run, excluded: [...left], excludedPaths: [...left] };
}

export type RecordedRuns = (task: string) => LocateResult | null;

let runs: Promise<RecordedRuns> | null = null;

/**
 * Fig. 1's recorded runs (written by `pnpm landing:record`), in a chunk of
 * their own that loads after the page, once the figure is near the screen. A
 * task outside the record answers null: the figure replays, it never
 * localizes, so no localizer code reaches a signed-out visitor.
 */
export function loadRecordedRuns(): Promise<RecordedRuns> {
  runs ??= import("@/lib/landing-runs.json")
    .then(({ default: record }) => {
      const byTask = new Map((record.runs as StoredRun[]).map((run) => [taskKey(run.task), expandRun(run)]));
      return (task: string) => byTask.get(taskKey(task)) ?? null;
    })
    .catch((error: unknown) => {
      // A failed chunk load must not stick: the next attempt gets a fresh try.
      runs = null;
      throw error;
    });
  return runs;
}

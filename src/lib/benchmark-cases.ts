import results from "../../benchmarks/heldout/results.json";

/**
 * The held-out localization benchmark (benchmarks/heldout/results.json,
 * written by `pnpm benchmark:heldout`), shaped for the landing page's case
 * board. Six third-party Repos Locus was never developed or tuned against, and
 * the ten most recent qualifying fixes in each, chosen by a written rule and
 * all scored. Read from the checked-in file rather than copied, so the page
 * cannot drift from the data.
 */
export type BenchmarkCase = {
  /** The fix commit: the change Locus had to find files for. */
  commit: string;
  /** The fix's parent commit, the Repo snapshot Locus ran on. */
  snapshot: string;
  /** "owner/name" on GitHub. */
  repo: string;
  /** The fix's commit subject, as its author wrote it. */
  subject: string;
  /** The task Locus was given: the subject, mechanically cleaned. */
  task: string;
  /** Source files the fix changed: the files the Slice had to contain. */
  fixFiles: string[];
  /** Of those, the files the Slice did contain. */
  found: string[];
  /** Files admitted to the Slice. */
  admitted: number;
  /** Source files in the Repo snapshot. */
  total: number;
  /** Estimated context reduction, Slice against the whole Repo. */
  reductionPct: number;
  widened: boolean;
  anchors: string[];
  /** The share of the fix files a random Slice of the same size would hold. */
  chancePct: number;
  /** The same case with the conventional-commit scope word taken out of the task. */
  withoutScope: { task: string; found: string[]; widened: boolean; reductionPct: number };
};

export const BENCHMARK_CASES: BenchmarkCase[] = results.results.map((result) => ({
  commit: result.commit,
  snapshot: result.snapshot,
  repo: result.repo,
  subject: result.subject,
  task: result.task,
  fixFiles: result.expected,
  found: result.found,
  admitted: result.sliceFiles,
  total: result.repositoryFiles,
  reductionPct: result.contextReductionPct,
  widened: result.widened,
  anchors: result.anchors,
  chancePct: Math.round(result.chanceRecall * 100),
  withoutScope: {
    task: result.withoutScope.task,
    found: result.withoutScope.found,
    widened: result.withoutScope.widened,
    reductionPct: result.withoutScope.contextReductionPct,
  },
}));

/** The case the board opens on: the held-out run the README's hero replays (assets/readme/hero-run.json). */
export const FEATURED_COMMIT = "bc273fd";

const { summary } = results;

export const BENCHMARK_SUMMARY = {
  generatedAt: summary.generatedAt,
  cases: summary.cases,
  repositories: summary.repositories,
  fixFileRecallPct: Math.round(summary.fixFileRecall * 100),
  widenedCases: summary.widenedCases,
  /** Cases where Locus committed to a Slice smaller than the Repo. */
  localizedCases: summary.localized.cases,
  medianContextReductionPct: summary.localized.medianContextReductionPct,
  /** What a random Slice of the same size would recall, on the localized cases. */
  chanceRecallPct: Math.round(summary.localized.chanceFixFileRecall * 100),
};

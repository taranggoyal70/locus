import results from "../../benchmarks/results.json";

/**
 * The historical-task benchmark (benchmarks/results.json, written by
 * `pnpm benchmark`), shaped for the landing page's case board. Read from the
 * checked-in file rather than copied, so the page cannot drift from the data.
 */
export type BenchmarkCase = {
  /** The fix commit: the change Locus had to find files for. */
  commit: string;
  /** The fix's parent commit, the Repo snapshot Locus ran on. */
  snapshot: string;
  /** "owner/name" on GitHub. */
  repo: string;
  task: string;
  featured: boolean;
  /** Source files the fix changed: the files the Slice had to contain. */
  fixFiles: string[];
  /** Of those, the files the Slice did contain. */
  found: string[];
  /** Files admitted to the Slice. */
  admitted: number;
  /** Source files in the Repo snapshot. */
  total: number;
  /** Estimated context reduction, initial Slice against the whole Repo. */
  reductionPct: number;
  widened: boolean;
  anchors: string[];
};

function counts(files: string): { admitted: number; total: number } {
  const [admitted, total] = files.split("/").map(Number);
  if (!Number.isInteger(admitted) || !Number.isInteger(total)) {
    throw new Error(`benchmarks/results.json: unreadable file count "${files}"`);
  }
  return { admitted, total };
}

export const BENCHMARK_CASES: BenchmarkCase[] = results.results.map((result) => ({
  commit: result.commit,
  snapshot: result.snapshot,
  repo: result.repo,
  task: result.task,
  featured: result.featured,
  fixFiles: result.expected,
  found: result.found,
  ...counts(result.files),
  reductionPct: result.contextReductionPct,
  widened: result.widened,
  anchors: result.anchors,
}));

export const BENCHMARK_SUMMARY = {
  generatedAt: results.summary.generatedAt,
  cases: results.summary.cases,
  repositories: results.summary.repositories,
  fixFileRecallPct: Math.round(results.summary.fixFileRecall * 100),
  medianContextReductionPct: results.summary.medianContextReductionPct,
  widenedCases: results.summary.widenedCases,
};

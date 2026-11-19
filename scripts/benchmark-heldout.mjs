// Held-out localization benchmark.
//
// The historical suite in scripts/benchmark.mjs replays fixes from repositories
// this project's author owns, and it gates on full recall, so a case Locus
// misses has to be removed before the build passes. That makes it a useful
// regression gate and a weak measurement: it can only ever report 100%.
//
// This script measures instead. benchmarks/heldout/protocol.json freezes a set
// of third-party repositories Locus was never developed against, pins each one
// to a commit, and states a mechanical rule for picking cases. Every commit the
// rule selects is scored, including the ones Locus gets wrong. Nothing here
// gates CI; the output is a report.
//
//   node scripts/benchmark-heldout.mjs           # print the report
//   node scripts/benchmark-heldout.mjs --write   # also write benchmarks/heldout/

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { buildGraph, loadLocalRepo, locate } from "../bin/core.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(projectRoot, "benchmarks/heldout");

const TEST_DIRS = new Set(["__tests__", "__test__", "test", "tests", "e2e", "spec"]);
const TEST_FILE_RE = /\.(test|spec|test-d|bench)\.[cm]?[jt]sx?$/;
const PR_SUFFIX_RE = /\s*\(#\d+\)\s*$/;
const FIX_PREFIX_RE = /^fix(?:\(([^)]*)\))?!?\s*:?\s*/i;

/** True for files a commit changes to test a fix rather than make it. */
export function isTestPath(file) {
  const parts = file.split("/");
  return TEST_FILE_RE.test(parts.at(-1)) || parts.slice(0, -1).some((part) => TEST_DIRS.has(part));
}

/** True when a commit subject names a fix, by the protocol's rule. */
export function isFixSubject(subject) {
  return /^fix\b/i.test(subject.trim());
}

/**
 * The task text an engineer would plausibly type, derived mechanically from the
 * commit subject: the keyword goes, the scope stays as plain words, and the
 * pull-request number goes because it carries no meaning for localization.
 */
export function taskFromSubject(subject, { keepScope = true } = {}) {
  const trimmed = subject.trim().replace(PR_SUFFIX_RE, "");
  const match = FIX_PREFIX_RE.exec(trimmed);
  if (!match) return trimmed;
  const scope = keepScope ? (match[1] ?? "").replace(/[-_/,]+/g, " ").trim() : "";
  const rest = trimmed.slice(match[0].length).trim();
  return [scope, rest].filter(Boolean).join(" ");
}

/** Recall and reduction for one task against one snapshot. */
function score(task, snapshot, graph, expected) {
  const located = locate(task, snapshot, graph);
  const selected = new Set(located.slice.map((file) => file.path));
  return { located, found: expected.filter((file) => selected.has(file)) };
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function ratio(numerator, denominator) {
  return denominator ? numerator / denominator : null;
}

/** Aggregate per-case results. Exported so the arithmetic is tested directly. */
export function summarize(results) {
  const localized = results.filter((result) => !result.widened);
  const expectedTotal = (cases) => cases.reduce((sum, result) => sum + result.expected.length, 0);
  const foundTotal = (cases) => cases.reduce((sum, result) => sum + result.found.length, 0);
  const mean = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);
  return {
    cases: results.length,
    repositories: new Set(results.map((result) => result.repo)).size,
    fixFileRecall: ratio(foundTotal(results), expectedTotal(results)),
    casesWithFullRecall: results.filter((result) => result.found.length === result.expected.length).length,
    medianContextReductionPct: median(results.map((result) => result.contextReductionPct)),
    widenedCases: results.length - localized.length,
    localized: {
      cases: localized.length,
      fixFileRecall: ratio(foundTotal(localized), expectedTotal(localized)),
      casesWithFullRecall: localized.filter((result) => result.found.length === result.expected.length).length,
      medianContextReductionPct: median(localized.map((result) => result.contextReductionPct)),
      meanChanceRecall: mean(localized.map((result) => result.chanceRecall)),
      medianSliceTokens: median(localized.map((result) => result.sliceTokens)),
      medianRepositoryTokens: median(localized.map((result) => result.repositoryTokens)),
    },
  };
}

function git(cwd, args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function cacheRoot() {
  return process.env.LOCUS_BENCH_CACHE ?? path.join(os.tmpdir(), "locus-benchmarks", "heldout");
}

function ensureClone(repo, head) {
  const dir = path.join(cacheRoot(), repo.replace("/", "--"));
  if (!fs.existsSync(path.join(dir, ".git"))) {
    fs.mkdirSync(path.dirname(dir), { recursive: true });
    execFileSync("git", ["clone", "--quiet", "--no-checkout", `https://github.com/${repo}.git`, dir], {
      stdio: ["ignore", "ignore", "inherit"],
    });
  }
  try {
    git(dir, ["cat-file", "-e", `${head}^{commit}`]);
  } catch {
    git(dir, ["fetch", "--quiet", "origin"]);
    git(dir, ["cat-file", "-e", `${head}^{commit}`]);
  }
  return dir;
}

function modifiedFiles(cwd, commit) {
  return git(cwd, ["diff-tree", "--no-commit-id", "--name-status", "-r", `${commit}^`, commit])
    .split("\n")
    .map((line) => line.split("\t"))
    .filter(([status]) => status === "M")
    .map(([, file]) => file);
}

function withSnapshot(cwd, ref, run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "locus-heldout-"));
  git(cwd, ["worktree", "add", "--quiet", "--detach", dir, ref]);
  try {
    return run(dir);
  } finally {
    git(cwd, ["worktree", "remove", "--force", dir]);
  }
}

function runRepository({ repo, head }, selection) {
  const cwd = ensureClone(repo, head);
  const commits = git(cwd, ["rev-list", "--first-parent", "--no-merges", head]).split("\n");
  const results = [];
  for (const commit of commits) {
    if (results.length >= selection.casesPerRepository) break;
    const subject = git(cwd, ["log", "-1", "--format=%s", commit]);
    if (!isFixSubject(subject)) continue;
    // Cheap pre-filter on the commit alone, before paying for a checkout.
    const candidates = modifiedFiles(cwd, commit).filter((file) => !isTestPath(file));
    if (!candidates.length) continue;

    const result = withSnapshot(cwd, `${commit}^`, (dir) => {
      const snapshot = loadLocalRepo(dir);
      const graph = buildGraph(snapshot);
      const nodes = new Set(graph.nodes.map((node) => node.path));
      const expected = candidates.filter((file) => nodes.has(file));
      const { minimum, maximum } = selection.expectedFileCount;
      if (expected.length < minimum || expected.length > maximum) return null;

      const task = taskFromSubject(subject);
      const { located, found } = score(task, snapshot, graph, expected);
      // Ablation: the conventional-commit scope often names the module that was
      // fixed ("devtools", "jsx dom"), which hands the localizer a path match. The
      // same case without it shows how much of the result depends on that word.
      const unscopedTask = taskFromSubject(subject, { keepScope: false });
      const unscoped = unscopedTask === task ? { located, found } : score(unscopedTask, snapshot, graph, expected);
      return {
        repo,
        commit: commit.slice(0, 7),
        snapshot: git(cwd, ["rev-parse", "--short=7", `${commit}^`]),
        subject,
        task,
        expected,
        found,
        widened: located.widened,
        sliceFiles: located.slice.length,
        repositoryFiles: graph.nodes.length,
        sliceTokens: located.sliceTokens,
        repositoryTokens: located.totalTokens,
        contextReductionPct: located.savedPct,
        chanceRecall: located.slice.length / graph.nodes.length,
        anchors: located.anchorPaths,
        withoutScope: {
          task: unscopedTask,
          found: unscoped.found,
          widened: unscoped.located.widened,
          contextReductionPct: unscoped.located.savedPct,
          chanceRecall: unscoped.located.slice.length / graph.nodes.length,
        },
      };
    });
    if (result) results.push(result);
  }
  if (results.length < selection.casesPerRepository) {
    throw new Error(
      `${repo}@${head.slice(0, 7)} has ${results.length} qualifying fixes; the protocol needs ${selection.casesPerRepository}`,
    );
  }
  return results;
}

function percent(value) {
  return value === null ? "n/a" : `${(value * 100).toFixed(1)}%`;
}

function renderMarkdown(protocol, summary, results) {
  const rows = results.map((result) =>
    `| ${result.repo} | \`${result.commit}\` | ${result.task.replaceAll("|", "\\|")} | ${result.found.length}/${result.expected.length} | ${result.widened ? "widened" : `${result.contextReductionPct}%`} | ${result.withoutScope.found.length}/${result.expected.length}${result.withoutScope.widened ? " (widened)" : ""} |`,
  ).join("\n");
  const { localized, withoutScope: unscoped } = summary;
  return `# Locus held-out localization benchmark

Generated ${summary.generatedAt} from [\`protocol.json\`](./protocol.json) (${protocol.version}, frozen ${protocol.frozenAt}).

Locus was run on the parent snapshot of ${summary.cases} bug fixes from ${summary.repositories} third-party
TypeScript repositories that it was never developed or tuned against. The cases were not chosen by hand: the
protocol takes the ${protocol.selection.casesPerRepository} most recent first-parent commits per repository whose
subject starts with "fix" and that modify 1 to 3 non-test source files, and every one of them is scored here,
misses included. The task text is the commit subject, mechanically cleaned.

## Results

| Measure | All cases | Localized cases | All cases, scope removed | Localized, scope removed |
|---|---:|---:|---:|---:|
| Cases | ${summary.cases} | ${localized.cases} | ${unscoped.cases} | ${unscoped.localized.cases} |
| Fix-file recall | ${percent(summary.fixFileRecall)} | ${percent(localized.fixFileRecall)} | ${percent(unscoped.fixFileRecall)} | ${percent(unscoped.localized.fixFileRecall)} |
| Cases with every fix file in the Slice | ${summary.casesWithFullRecall}/${summary.cases} | ${localized.casesWithFullRecall}/${localized.cases} | ${unscoped.casesWithFullRecall}/${unscoped.cases} | ${unscoped.localized.casesWithFullRecall}/${unscoped.localized.cases} |
| Widened to the whole repository | ${summary.widenedCases} | | ${unscoped.widenedCases} | |
| Median estimated context reduction | ${summary.medianContextReductionPct}% | ${localized.medianContextReductionPct}% | ${unscoped.medianContextReductionPct}% | ${unscoped.localized.medianContextReductionPct}% |
| Recall of a random Slice of the same size | | ${percent(localized.meanChanceRecall)} | | ${percent(unscoped.localized.meanChanceRecall)} |

- **Widened** cases are the conservative fallback: no file matched with enough confidence, so Locus returned
  the whole repository. They score full recall by definition and save nothing.
- **Localized** cases are the ones where Locus committed to a smaller Slice. Their recall is the honest
  measure of the ranking; the random-Slice row is what picking the same number of files blindly would recall.
- **Scope removed** is an ablation added after the first run to test it. Conventional-commit scopes often name
  the fixed module (\`devtools\`, \`jsx dom\`), which hands the localizer a path match, so the same cases are
  rerun with the scope deleted from the task. The primary protocol was not changed.
- Median Slice size on localized cases: ${localized.medianSliceTokens?.toLocaleString("en-US")} estimated tokens,
  against a median repository of ${localized.medianRepositoryTokens?.toLocaleString("en-US")}.

## Every case

| Repository | Fix | Task | Fix files in Slice | Context reduction | Scope removed |
|---|---|---|---:|---:|---:|
${rows}

## What this does and does not show

It shows whether the files a maintainer changed to fix a bug are in the Slice Locus returns for a one-line
description of that bug, on code Locus has never seen. It does not show that an agent given the Slice would
have produced the fix, that the excluded files were unnecessary, or how answer quality changes; that needs
the paired agent study in [\`../release1\`](../release1/README.md). Commit subjects are terser than real task
descriptions and carry no error text, which makes localization harder than with \`--evidence\`. Token counts
are Locus's chars/4 estimate, not a model tokenizer.

Reproduce with \`node scripts/benchmark-heldout.mjs\`. Repositories are cloned once into
\`${"$"}{TMPDIR}/locus-benchmarks/heldout\` (override with \`LOCUS_BENCH_CACHE\`).
`;
}

function main() {
  const protocol = JSON.parse(fs.readFileSync(path.join(outputDir, "protocol.json"), "utf8"));
  const results = protocol.repositories.flatMap((entry) => {
    process.stderr.write(`${entry.repo}…\n`);
    return runRepository(entry, protocol.selection);
  });
  const summary = {
    generatedAt: new Date().toISOString(),
    protocolVersion: protocol.version,
    ...summarize(results),
    withoutScope: summarize(results.map((result) => ({ ...result, ...result.withoutScope }))),
  };
  const markdown = renderMarkdown(protocol, summary, results);
  if (process.argv.includes("--write")) {
    fs.writeFileSync(path.join(outputDir, "results.json"), `${JSON.stringify({ summary, results }, null, 2)}\n`);
    fs.writeFileSync(path.join(outputDir, "README.md"), markdown);
  }
  console.log(markdown);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

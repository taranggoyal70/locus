import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildGraph, locate } from "../bin/core.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const casesPath = path.join(projectRoot, "benchmarks/cases.json");
const cases = JSON.parse(fs.readFileSync(casesPath, "utf8"));
const shouldWrite = process.argv.includes("--write");
const IGNORE_DIRS = new Set(["node_modules", ".next", "dist", "build", ".git", "tests", "test", "e2e"]);

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();
}

function resolveRepo(entry) {
  const local = path.resolve(projectRoot, entry.localPath);
  if (fs.existsSync(path.join(local, ".git"))) return local;
  const cache = path.join(os.tmpdir(), "locus-benchmarks", entry.repo.replace("/", "--"));
  if (!fs.existsSync(path.join(cache, ".git"))) {
    fs.mkdirSync(path.dirname(cache), { recursive: true });
    execFileSync("git", ["clone", "--quiet", `https://github.com/${entry.repo}.git`, cache]);
  } else {
    git(cache, ["fetch", "--quiet", "origin"]);
  }
  return cache;
}

function isSourceFile(file) {
  const parts = file.split("/");
  return /\.(ts|tsx)$/.test(file) && !parts.some((part) => part.startsWith(".") || IGNORE_DIRS.has(part));
}

function commonDirPrefix(files) {
  const dirs = files.map((file) => file.split("/").slice(0, -1)).filter((parts) => parts.length);
  if (!dirs.length) return "";
  let common = dirs[0];
  for (const current of dirs.slice(1)) {
    let index = 0;
    while (index < common.length && index < current.length && common[index] === current[index]) index++;
    common = common.slice(0, index);
    if (!common.length) break;
  }
  const sourceIndex = common.lastIndexOf("src");
  if (sourceIndex >= 0) return common.slice(0, sourceIndex + 1).join("/");
  const surfaceIndex = common.findIndex((part) => part === "app" || part === "pages");
  if (surfaceIndex >= 0) return common.slice(0, surfaceIndex).join("/");
  return common.join("/");
}

function snapshotRepo(cwd, ref, repoName) {
  const paths = git(cwd, ["ls-tree", "-r", "--name-only", ref]).split("\n").filter(isSourceFile);
  const files = {};
  for (const file of paths) files[file] = git(cwd, ["show", `${ref}:${file}`]);
  const chunks = git(cwd, ["log", "-n", "5", "--name-only", "--pretty=format:%x01", ref])
    .split("\x01").map((chunk) => chunk.trim()).filter(Boolean);
  const recent = [];
  const seen = new Set();
  const bulkThreshold = Math.max(2, Math.floor(0.4 * paths.length));
  for (const chunk of chunks) {
    const changed = chunk.split("\n").map((file) => file.trim()).filter(Boolean);
    if (changed.length === 0 || changed.length > bulkThreshold) continue;
    for (const file of changed) {
      if (files[file] !== undefined && !seen.has(file)) {
        seen.add(file);
        recent.push(file);
      }
    }
  }
  return {
    name: repoName,
    slug: repoName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    description: `Historical snapshot at ${ref}`,
    root: commonDirPrefix(paths),
    recentlyChanged: [...new Set(recent)],
    files,
  };
}

function changedExistingSourceFiles(cwd, commit, parentFiles) {
  return git(cwd, ["diff-tree", "--no-commit-id", "--name-status", "-r", commit])
    .split("\n")
    .map((line) => line.split("\t"))
    .filter(([status, file]) => status === "M" && parentFiles[file] !== undefined)
    .map(([, file]) => file)
    .filter(isSourceFile);
}

const results = [];
for (const entry of cases) {
  const cwd = resolveRepo(entry);
  const commit = git(cwd, ["rev-parse", entry.commit]);
  const parent = `${commit}^`;
  const repo = snapshotRepo(cwd, parent, entry.repo);
  const expected = changedExistingSourceFiles(cwd, commit, repo.files);
  if (!expected.length) throw new Error(`${entry.repo}@${entry.commit} has no modified source files in its parent snapshot`);
  const result = locate(entry.task, repo, buildGraph(repo));
  const localized = !result.widened && result.slice.length < Object.keys(repo.files).length;
  const selected = new Set(result.slice.map((file) => file.path));
  const found = expected.filter((file) => selected.has(file));
  results.push({
    repo: entry.repo,
    commit: commit.slice(0, 7),
    snapshot: git(cwd, ["rev-parse", parent]).slice(0, 7),
    task: entry.task,
    featured: entry.featured === true,
    expected,
    found,
    safeRecall: found.length / expected.length,
    focusedRecall: localized ? found.length / expected.length : null,
    localized,
    widened: result.widened,
    files: `${result.slice.length}/${Object.keys(repo.files).length}`,
    contextReductionPct: result.savedPct,
    anchors: result.anchors,
  });
}

const reductions = results.map((result) => result.contextReductionPct).sort((a, b) => a - b);
const focusedResults = results.filter((result) => result.localized);
const focusedFilesFound = focusedResults.reduce((sum, result) => sum + result.found.length, 0);
const focusedFilesExpected = focusedResults.reduce((sum, result) => sum + result.expected.length, 0);
const allFilesExpected = results.reduce((sum, result) => sum + result.expected.length, 0);
const summary = {
  generatedAt: new Date().toISOString(),
  cases: results.length,
  repositories: new Set(results.map((result) => result.repo)).size,
  localizedCases: focusedResults.length,
  taskLocalizationRate: focusedResults.length / results.length,
  focusedFixFileRecall: focusedFilesFound / focusedFilesExpected,
  focusedFilesFound,
  focusedFilesExpected,
  effectiveFixFileCoverage: focusedFilesFound / allFilesExpected,
  focusedCasesWithFullRecall: focusedResults.filter((result) => result.focusedRecall === 1).length,
  medianContextReductionPct: reductions[Math.floor(reductions.length / 2)],
  widenedCases: results.filter((result) => result.widened).length,
  gate: {
    focusedRecallIsPerfect: focusedFilesFound === focusedFilesExpected,
    taskLocalizationAtLeast80Pct: focusedResults.length / results.length >= 0.8,
    effectiveCoverageAtLeast80Pct: focusedFilesFound / allFilesExpected >= 0.8,
    medianReductionAtLeast30Pct: reductions[Math.floor(reductions.length / 2)] >= 30,
  },
};

const output = {
  methodology: "Historical parent snapshots; expected files are modified TypeScript source files from each next commit. Safe Widen fallbacks are reported separately and never counted as successful localization.",
  summary,
  results,
};
const json = `${JSON.stringify(output, null, 2)}\n`;
const table = results.map((result) =>
  `| ${result.repo.split("/")[1]} | \`${result.commit}\` | ${result.localized ? `${result.found.length}/${result.expected.length}` : "not scored"} | ${result.contextReductionPct}% | ${result.widened ? "yes" : "no"} |`,
).join("\n");
const markdown = `# Locus historical-task benchmark\n\n` +
  `Generated ${summary.generatedAt}. Locus was run on the parent snapshot of ${summary.cases} real fixes across ${summary.repositories} repositories. ` +
  `The expected set is the TypeScript source files modified by the historical fix. A safe Widen retains every loaded file, but it is not counted as a successful localization.\n\n` +
  `| Repository | Fix | Focused fix files found | Context reduction | Safe Widen |\n|---|---:|---:|---:|---:|\n${table}\n\n` +
  `## Launch gate\n\n- Tasks localized without Widen: **${Math.round(summary.taskLocalizationRate * 100)}%** (${summary.localizedCases}/${summary.cases})\n` +
  `- Fix-file recall on localized tasks: **${Math.round(summary.focusedFixFileRecall * 100)}%** (${summary.focusedFilesFound}/${summary.focusedFilesExpected} files; ${summary.focusedCasesWithFullRecall}/${summary.localizedCases} cases with full recall)\n` +
  `- End-to-end focused fix-file coverage: **${Math.round(summary.effectiveFixFileCoverage * 100)}%** (Widen fallbacks receive no localization credit)\n` +
  `- Median estimated context reduction: **${summary.medianContextReductionPct}%**\n- Conservative all-loaded-file fallbacks: **${summary.widenedCases}**\n` +
  `- Gate: **${summary.gate.focusedRecallIsPerfect && summary.gate.taskLocalizationAtLeast80Pct && summary.gate.effectiveCoverageAtLeast80Pct && summary.gate.medianReductionAtLeast30Pct ? "PASS" : "FAIL"}**\n\n` +
  `## What this does—and does not—show\n\nThis replay measures whether Locus includes the files humans actually changed next, while estimating how much TypeScript context it excludes. ` +
  `It does **not** prove that an autonomous agent completed the task, that the excluded files were unnecessary, or that quality cannot regress. Token estimates use the existing character-based heuristic. ` +
  `Agent completion rate is a beta-study outcome, not a benchmark claim.\n\n` +
  `Cases are declared in [\`benchmarks/cases.json\`](./cases.json); run \`pnpm benchmark\` to reproduce them.\n`;

if (shouldWrite) {
  fs.writeFileSync(path.join(projectRoot, "benchmarks/results.json"), json);
  fs.writeFileSync(path.join(projectRoot, "benchmarks/README.md"), markdown);
}

console.log(markdown);
if (
  !summary.gate.focusedRecallIsPerfect
  || !summary.gate.taskLocalizationAtLeast80Pct
  || !summary.gate.effectiveCoverageAtLeast80Pct
  || !summary.gate.medianReductionAtLeast30Pct
) process.exitCode = 1;

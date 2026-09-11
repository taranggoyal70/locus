// Locus workspace loader — the client-safe half of the old core.mjs.
//
// This file holds local-repo loading and presentation glue only. The Graph and
// Slice algorithms (buildGraph, locate) deliberately do NOT live here: they run
// server-side, and the published client reaches them over /api/v1/locate. That
// split is the reason this package can ship at all — everything in this file is
// filesystem walking and formatting, none of it proprietary logic.
//
// Keep it dependency-free. The package's whole claim is that it installs with
// nothing behind it.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const SOURCE_EXT_RE = /\.(tsx?|jsx?|mts|cts|mjs|cjs|py|vue|svelte|astro)$/;

// CLI/MCP helpers (not mirrored from localizer.ts) — local repo loading and
// plain-text presentation shared by bin/locus.mjs and bin/mcp.mjs.
// ---------------------------------------------------------------------------

// Vendored and generated directories, in both ecosystems. Dotdirs (.venv,
// .tox, .git) are skipped separately by the walker, so only the undotted
// Python conventions need naming here.
// Read for aliases and workspace names; never Graph nodes, because
// SOURCE_EXT_RE excludes .json.
const MANIFEST_FILES = new Set(["package.json", "tsconfig.json", "jsconfig.json"]);

const IGNORE_DIRS = new Set([
  "node_modules", ".next", "dist", "build", ".git", "tests",
  "__pycache__", "venv", "site-packages", "eggs",
]);

function toPosix(p) {
  return p.split(path.sep).join("/");
}

function walk(dir, baseDir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    // Skip ignored dirs and any dotdir (.git, .next, .vercel, …).
    if (entry.isDirectory() && (entry.name.startsWith(".") || IGNORE_DIRS.has(entry.name))) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, baseDir, out);
    } else if (entry.isFile() && (SOURCE_EXT_RE.test(entry.name) || MANIFEST_FILES.has(entry.name))) {
      // package.json is loaded but never becomes a node: SOURCE_EXT_RE excludes
      // it. It is read only to map a workspace package name to its directory,
      // so a monorepo's cross-package imports become real edges.
      out.push(toPosix(path.relative(baseDir, full)));
    }
  }
}

/**
 * Longest common directory prefix across all loaded files — this is the
 * `root` prefix that every path in RepoData.files is expected to share (per
 * types.ts). Top-level loose files (e.g. next.config.ts) have no directory
 * component and are excluded from the computation so they can't collapse a
 * real "src" root down to "".
 */
function commonDirPrefix(relPaths) {
  const dirLists = relPaths.map((p) => p.split("/").slice(0, -1)).filter((segs) => segs.length > 0);
  if (dirLists.length === 0) return "";
  let common = dirLists[0];
  for (let i = 1; i < dirLists.length; i++) {
    const cur = dirLists[i];
    let j = 0;
    while (j < common.length && j < cur.length && common[j] === cur[j]) j++;
    common = common.slice(0, j);
    if (common.length === 0) break;
  }
  return common.join("/");
}

/**
 * Best-effort "recent signal" from git history: the files touched by the
 * last 8 commits, skipping bulk commits that touch more than 40% of the
 * repo's loaded files (those are low-signal — a rename sweep, a formatter
 * pass, etc — not a targeted recent change). Returns [] on any failure
 * (no git, not a repo, git not installed, …).
 */
function getRecentlyChanged(dir, knownPaths) {
  try {
    const knownSet = new Set(knownPaths);
    const total = knownPaths.length || 1;
    const out = execFileSync(
      "git",
      ["log", "-n", "8", "--name-only", "--pretty=format:%x01"],
      { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    const chunks = out.split("\x01").map((s) => s.trim()).filter(Boolean);
    const recent = [];
    const seen = new Set();
    for (const chunk of chunks) {
      const files = chunk.split("\n").map((s) => s.trim()).filter(Boolean);
      if (files.length === 0) continue;
      if (files.length / total > 0.4) continue; // bulk commit — skip
      for (const f of files) {
        const posixF = toPosix(f);
        if (knownSet.has(posixF) && !seen.has(posixF)) {
          seen.add(posixF);
          recent.push(posixF);
        }
      }
    }
    return recent;
  } catch {
    return [];
  }
}

/** Walk a local directory into the RepoData shape localizer.ts expects. */
export function loadLocalRepo(dir) {
  const absDir = path.resolve(dir);

  // A path that is not a readable directory is an error, not an empty Repo.
  //
  // Without this, a mistyped --path produced "Repo: /no/such/dir", "WIDENED to
  // whole repo", and a Slice of zero files: the conservative fallback reporting
  // that it had returned everything, having returned nothing. Widen is the
  // safety guarantee, so a Widen that is silently empty is the worst possible
  // wrong answer — and the caller is usually an agent, which has no way to tell
  // "this repository is empty" from "you typed the path wrong".
  let stats;
  try {
    stats = fs.statSync(absDir);
  } catch {
    throw new Error(`Repo directory does not exist: ${absDir}`);
  }
  if (!stats.isDirectory()) {
    throw new Error(`Repo path is not a directory: ${absDir}`);
  }

  const relPaths = [];
  walk(absDir, absDir, relPaths);
  relPaths.sort();
  const root = commonDirPrefix(relPaths);
  const files = {};
  for (const rel of relPaths) {
    try {
      files[rel] = fs.readFileSync(path.join(absDir, rel), "utf8");
    } catch {
      // unreadable (permissions, broken symlink, …) — skip
    }
  }
  // A directory with no supported source is an error, not an empty Repo.
  //
  // Without this the CLI and MCP answered "WIDENED to whole repo" over a Slice
  // of zero files — the conservative fallback reporting that it had returned
  // everything, having returned nothing. The hosted workspace importer already refuses this
  // case ("No JavaScript or TypeScript source found"), so the two surfaces
  // disagreed on identical input and the CLI was the one that stayed quiet.
  //
  // It is a normal thing to hit: pointing at the wrong directory, at a project
  // in another language, or at one whose sources all live under an ignored path.
  if (Object.keys(files).length === 0) {
    throw new Error(
      `No supported source found in: ${absDir} (looked for .ts, .tsx, .js, .jsx, .mjs, .cjs, .py)`,
    );
  }

  const loadedPaths = Object.keys(files);
  const recentlyChanged = getRecentlyChanged(absDir, loadedPaths);
  const name = path.basename(absDir) || "repo";
  return {
    name,
    slug: name,
    description: `Local repo at ${absDir}`,
    dir: absDir,
    root,
    recentlyChanged,
    files,
  };
}

/**
 * Every emitted path is relative to the analyzed directory, which is not
 * necessarily the reader's cwd (`locus locate --path ../other`, or an MCP
 * client with several configured roots). A path is only resolvable next to
 * that directory, so every output surface below states it, and none of them
 * will render without it.
 */
function analyzedDir(repo, surface) {
  if (!repo?.dir) {
    throw new Error(
      `${surface}() needs the repo from loadLocalRepo(): its dir is what every emitted path is relative to`,
    );
  }
  return repo.dir;
}

function sparseGraphWarning(result) {
  if (!result.sparse || result.widened) return null;
  return (
    `warning: few internal imports resolved (${result.edgeDensity.toFixed(2)} edges/file), `
    + `so this slice may be missing real dependencies and the saving above may be overstated`
  );
}

/** Human-readable summary of a LocateResult (shared by CLI + MCP). */
export function formatResult(result, repo) {
  const lines = [`Repo: ${analyzedDir(repo, "formatResult")}  (paths below are relative to this directory)`];
  if (result.widened) {
    lines.push(`WIDENED to whole repo — ${result.reason}`);
    if (result.refinement?.unmatchedTerms.length) {
      lines.push(`Unmatched task terms: ${result.refinement.unmatchedTerms.join(", ")}`);
    }
    if (result.refinement?.candidateFilePaths.length) {
      // Emit repo-relative paths, not source-root-relative ones: whatever reads
      // this text (an agent over MCP, or a human) has to be able to open the file.
      lines.push(`Possible starting files: ${result.refinement.candidateFilePaths.join(", ")}`);
    }
    if (result.refinement?.repositoryTerms.length) {
      lines.push(`Refine with a filename, symbol, or repo term: ${result.refinement.repositoryTerms.join(", ")}`);
    }
  } else {
    lines.push(`Anchor: ${result.anchorPaths.join(", ")}`);
  }
  lines.push("");
  lines.push(`Slice (${result.slice.length} file${result.slice.length === 1 ? "" : "s"}):`);
  for (const f of result.slice) {
    const marker = f.recent ? "  [changed]" : "";
    lines.push(`  ${f.path}  (dist ${f.dist}, ~${f.tokens} tok)${marker}`);
  }
  lines.push("");
  lines.push(`Excluded: ${result.excluded.length} file${result.excluded.length === 1 ? "" : "s"}`);
  lines.push(`context: ${result.sliceTokens}/${result.totalTokens} tokens — ${result.savedPct}% fewer`);
  // A sparse graph makes a small Slice look like a good localization when it is
  // really an unresolved-import artifact, and the reported saving is then too
  // high rather than too low. Say so next to the number it undermines. A widen
  // needs no warning: returning the whole repository is already the honest
  // answer to weak evidence.
  const warning = sparseGraphWarning(result);
  if (warning) {
    lines.push(warning);
  }
  return lines.join("\n");
}

/**
 * Build a ready-to-paste context block for a LocateResult's slice, in ranked
 * order, stopping once adding the next file would exceed `budget` tokens
 * (the anchor file itself is always included even if it alone exceeds
 * budget, so --pack never returns empty).
 */
export function buildPackedContext(result, repo, budget = 40000) {
  const dir = analyzedDir(repo, "buildPackedContext");
  const budgetN = Number(budget) > 0 ? Number(budget) : 40000;
  const included = [];
  const dropped = [];
  const bodies = new Map();
  let used = 0;
  let truncatedPath = null;
  for (const f of result.slice) {
    if (included.length > 0 && used + f.tokens > budgetN) {
      dropped.push(f.path);
      continue;
    }
    const source = repo.files[f.path] ?? "";

    // The first file is admitted whatever its size, so the pack is never empty
    // — but admitting it whole made the budget advisory rather than binding: a
    // single 270,000-token file was emitted for a request that asked for 2,000.
    // The caller is usually an agent spending its own context window on this, so
    // it is cut to fit and told that it was.
    if (included.length === 0 && f.tokens > budgetN) {
      const body = source.slice(0, budgetN * CHARS_PER_TOKEN);
      bodies.set(f.path, body);
      included.push(f);
      used += estimateTokens(body);
      truncatedPath = f.path;
      continue;
    }

    bodies.set(f.path, source);
    included.push(f);
    used += f.tokens;
  }
  let text = `# Context for: ${result.task}\n# Repo: ${dir}  (file paths below are relative to this directory)`;
  text += `\n# ${included.length} file${included.length === 1 ? "" : "s"}, ~${used} tokens`;
  const warning = sparseGraphWarning(result);
  if (warning) {
    text += `\n# ${warning}`;
  }
  if (truncatedPath) {
    text += `\n# ${truncatedPath} was truncated to fit the ${budgetN}-token budget; raise --budget to see all of it`;
  }
  for (const f of included) {
    text += `\n\n===== ${f.path} =====\n${bodies.get(f.path) ?? ""}`;
  }
  if (dropped.length) {
    text += `\n\n# ${dropped.length} file(s) omitted — exceeded budget of ${budgetN} tokens: ${dropped.join(", ")}`;
  }
  return { text, included, dropped, usedTokens: used, budget: budgetN };
}

/**
 * Machine-readable form of a LocateResult for `locus locate --json`. Its
 * `slice[].path`, `anchorPaths`, `excludedPaths` and `reason` are relative to
 * the analyzed directory, so an automated consumer needs that directory named
 * here the same way the text surfaces name it.
 */
export function buildJsonResult(result, repo) {
  const refinement = result.refinement
    ? {
        ...result.refinement,
        candidateFiles: result.refinement.candidateFilePaths ?? result.refinement.candidateFiles,
      }
    : null;
  return {
    ...result,
    dir: analyzedDir(repo, "buildJsonResult"),
    anchors: result.anchorPaths ?? result.anchors,
    slice: result.slice.map((file) => ({ ...file, rel: file.path })),
    excluded: result.excludedPaths ?? result.excluded,
    refinement,
  };
}

// Mirrors src/lib/localizer.ts — keep in sync.
//
// This is a faithful plain-JS/ESM port of buildGraph() + locate() from
// src/lib/localizer.ts and the shapes in src/lib/types.ts, so the CLI and MCP
// server can run with zero build step and zero npm dependencies. Do not
// change the anchoring/widen/ranking/token-estimate behavior here without
// changing it in localizer.ts first (and vice versa).
//
// Everything below the "CLI/MCP helpers" marker is NOT part of the ported
// algorithm — it's local-repo loading and presentation glue for this CLI.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

// ---------------------------------------------------------------------------
// Ported from src/lib/localizer.ts (buildGraph + locate)
// ---------------------------------------------------------------------------

// Any relative or alias import spec. We ignore bare package imports (react, …).
const IMPORT_RE = /['"](@\/[^'"]+|\.[^'"]+)['"]/g;

function estimateTokens(text) {
  return Math.max(1, Math.round(text.length / 4));
}

function topDir(rel) {
  return rel.includes("/") ? rel.split("/")[0] : "(root)";
}

function tryPath(base, files) {
  for (const c of [
    `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.jsx`,
    `${base}/index.ts`, `${base}/index.tsx`, `${base}/index.js`, `${base}/index.jsx`,
    base,
  ]) {
    if (files[c] !== undefined) return c;
  }
  return null;
}

/**
 * Resolve an import spec against the repo's flat file map. The `@/` alias maps
 * to different bases across repos (repo root, or `src/`), and the inferred
 * `root` can be empty — so try each plausible base and take the first hit.
 * (Mirrors src/lib/localizer.ts resolve — keep in sync.)
 */
function resolve(spec, fromPath, root, files) {
  if (spec.startsWith("@/")) {
    const rest = spec.slice(2);
    for (const p of [...new Set([root, "src", ""])]) {
      const hit = tryPath(p ? `${p}/${rest}` : rest, files);
      if (hit) return hit;
    }
    return null;
  }
  if (spec.startsWith(".")) {
    const dir = fromPath.split("/").slice(0, -1).join("/");
    return tryPath(normalize(`${dir}/${spec}`), files);
  }
  return null;
}

function normalize(p) {
  const parts = [];
  for (const seg of p.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return parts.join("/");
}

/** Build the deterministic dependency graph from the file map. */
export function buildGraph(repo) {
  const { files, root } = repo;
  const paths = Object.keys(files).filter((p) => /\.(tsx?|jsx?)$/.test(p));
  const nodes = [];
  const byPath = {};
  const deps = {};
  const rdeps = {};
  const edges = [];
  const surfaces = [];

  for (const p of paths) {
    deps[p] = [];
    rdeps[p] = rdeps[p] ?? [];
  }

  for (const p of paths) {
    const rel = p.startsWith(root + "/") ? p.slice(root.length + 1) : p;
    const isSurface = /^app\/.+\/page\.(tsx?|jsx?)$/.test(rel) || /^app\/page\.(tsx?|jsx?)$/.test(rel);
    let route;
    if (isSurface) {
      route =
        rel.replace(/^app\//, "").replace(/\/page\.(tsx?|jsx?)$/, "").replace(/page\.(tsx?|jsx?)$/, "") ||
        "home";
      surfaces.push({ route, path: p });
    }
    const node = {
      path: p,
      rel,
      dir: topDir(rel),
      tokens: estimateTokens(files[p]),
      isSurface,
      route,
    };
    nodes.push(node);
    byPath[p] = node;
  }

  for (const p of paths) {
    const seen = new Set();
    let m;
    IMPORT_RE.lastIndex = 0;
    while ((m = IMPORT_RE.exec(files[p]))) {
      const tgt = resolve(m[1], p, root, files);
      if (tgt && tgt !== p && !seen.has(tgt)) {
        seen.add(tgt);
        deps[p].push(tgt);
        (rdeps[tgt] ??= []).push(p);
        edges.push({ from: p, to: tgt });
      }
    }
  }

  const totalTokens = nodes.reduce((s, n) => s + n.tokens, 0);
  return { nodes, edges, byPath, deps, rdeps, surfaces, totalTokens };
}

/** BFS transitive dependency closure of an anchor, with distances. */
function closure(anchor, deps, maxDepth = 8) {
  const dist = { [anchor]: 0 };
  const q = [anchor];
  while (q.length) {
    const cur = q.shift();
    if (dist[cur] >= maxDepth) continue;
    for (const nxt of deps[cur] ?? []) {
      if (dist[nxt] === undefined) {
        dist[nxt] = dist[cur] + 1;
        q.push(nxt);
      }
    }
  }
  return dist;
}

// Low-signal words that must never anchor a task: verbs/adjectives of intent,
// conversational filler, and generic code nouns. A task made only of these
// (e.g. "help me", "fix this") has no feature signal and should Widen.
const STOP = new Set(["the", "a", "an", "is", "are", "in", "on", "of", "to", "fix",
  "bug", "issue", "error", "broken", "wrong", "not", "working", "page", "add", "make",
  "update", "change", "with", "and", "for", "my", "it", "shows", "show", "help", "me",
  "please", "hey", "hi", "this", "that", "how", "can", "you", "need", "want", "just",
  "some", "something", "what", "whats", "why", "where", "when", "who", "which", "does",
  "doesnt", "cant", "wont", "should", "would", "could", "get", "got", "let", "lets",
  "app", "code", "file", "files", "thing", "stuff", "please", "now", "here"]);

function taskWords(task) {
  // Require length >= 3 so short substrings ("me", "hi") can't false-match
  // ("me" inside "home"). Feature words are effectively always >= 3 chars.
  return new Set(
    task.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w)),
  );
}

function scoreAnchor(words, route, rel, source) {
  const pathTokens = new Set(
    (route + " " + rel).toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3),
  );
  const sourceTokens = new Set(
    source.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3),
  );
  let score = 0;
  let pathMatches = 0;
  const matchedWords = new Set();
  for (const w of words) {
    for (const h of pathTokens) {
      if (w === h) {
        score += 4;
        pathMatches++;
        matchedWords.add(w);
      }
      // prefix match for morphology ("dashboards" ~ "dashboard"), min length 4
      // and prefix-anchored so mid-word substrings never match.
      else if ((w.length >= 4 && h.startsWith(w)) || (h.length >= 4 && w.startsWith(h))) {
        score += 2;
        pathMatches++;
        matchedWords.add(w);
      }
    }
    if (sourceTokens.has(w)) {
      score += 1;
      matchedWords.add(w);
    }
  }
  return { score, pathMatches, matchedWords: matchedWords.size };
}

/**
 * Localize a task to the minimal relevant slice of the repo.
 * Conservative localization: if no file anchors with enough task evidence,
 * fall back to the whole repo instead of returning a speculative small slice.
 */
export function locate(task, repo, graph, evidence = "") {
  const { deps, rdeps, byPath } = graph;
  const recent = new Set(repo.recentlyChanged);
  const words = taskWords(`${task}\n${evidence}`);

  const scored = graph.nodes
    .map((node) => ({
      path: node.path,
      route: node.route ?? "",
      recent: recent.has(node.path),
      ...scoreAnchor(words, node.route ?? "", node.rel, repo.files[node.path] ?? ""),
    }))
    .filter((candidate) => candidate.pathMatches > 0 || candidate.matchedWords >= 2)
    .sort((a, b) => b.score - a.score || b.matchedWords - a.matchedWords);
  const best = scored[0]?.score ?? 0;

  if (!task.trim() || best < 3) {
    const slice = graph.nodes
      .map((n) => ({ path: n.path, rel: n.rel, dist: 0, tokens: n.tokens, recent: recent.has(n.path) }))
      .sort((a, b) => Number(b.recent) - Number(a.recent) || a.rel.localeCompare(b.rel));
    return {
      task,
      widened: true,
      reason: task.trim()
        ? "no file matched with enough confidence — widened to the whole repo"
        : "type a task to localize",
      anchors: [],
      slice,
      excluded: [],
      sliceTokens: graph.totalTokens,
      totalTokens: graph.totalTokens,
      savedPct: 0,
    };
  }

  const anchors = scored
    .filter((s) =>
      s.score >= Math.max(3, best - 1) ||
      s.matchedWords >= Math.min(3, words.size) ||
      (s.recent && s.matchedWords >= 2),
    )
    .slice(0, 6);
  const dist = {};
  for (const a of anchors) {
    for (const [f, d] of Object.entries(closure(a.path, deps))) {
      dist[f] = Math.min(dist[f] ?? 99, d);
    }
    if (!byPath[a.path].isSurface) {
      for (const consumer of rdeps[a.path] ?? []) {
        for (const [f, d] of Object.entries(closure(consumer, deps))) {
          dist[f] = Math.min(dist[f] ?? 99, d + 1);
        }
      }
    }
  }
  const sliceFiles = Object.keys(dist).map((p) => ({
    path: p, rel: byPath[p].rel, dist: dist[p], tokens: byPath[p].tokens, recent: recent.has(p),
  }));
  // rank: recently-changed first (cross-cutting), then dependency distance
  sliceFiles.sort((a, b) =>
    Number(b.recent) - Number(a.recent) || a.dist - b.dist || a.rel.localeCompare(b.rel),
  );
  const inSlice = new Set(Object.keys(dist));
  const excluded = graph.nodes.filter((n) => !inSlice.has(n.path)).map((n) => n.rel);
  const sliceTokens = sliceFiles.reduce((s, f) => s + f.tokens, 0);
  return {
    task,
    widened: false,
    reason: `matched ${anchors.map((a) => byPath[a.path].rel).join(", ")}`,
    anchors: anchors.map((a) => byPath[a.path].rel),
    slice: sliceFiles,
    excluded,
    sliceTokens,
    totalTokens: graph.totalTokens,
    savedPct: Math.round((100 * (graph.totalTokens - sliceTokens)) / graph.totalTokens),
  };
}

// ---------------------------------------------------------------------------
// CLI/MCP helpers (not mirrored from localizer.ts) — local repo loading and
// plain-text presentation shared by bin/locus.mjs and bin/mcp.mjs.
// ---------------------------------------------------------------------------

const IGNORE_DIRS = new Set(["node_modules", ".next", "dist", "build", ".git", "tests"]);

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
    } else if (entry.isFile() && /\.(tsx?|jsx?)$/.test(entry.name)) {
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
  const loadedPaths = Object.keys(files);
  const recentlyChanged = getRecentlyChanged(absDir, loadedPaths);
  const name = path.basename(absDir) || "repo";
  return {
    name,
    slug: name,
    description: `Local repo at ${absDir}`,
    root,
    recentlyChanged,
    files,
  };
}

/** Human-readable summary of a LocateResult (shared by CLI + MCP). */
export function formatResult(result) {
  const lines = [];
  if (result.widened) {
    lines.push(`WIDENED to whole repo — ${result.reason}`);
  } else {
    lines.push(`Anchor: ${result.anchors.join(", ")}`);
  }
  lines.push("");
  lines.push(`Slice (${result.slice.length} file${result.slice.length === 1 ? "" : "s"}):`);
  for (const f of result.slice) {
    const marker = f.recent ? "  [changed]" : "";
    lines.push(`  ${f.rel}  (dist ${f.dist}, ~${f.tokens} tok)${marker}`);
  }
  lines.push("");
  lines.push(`Excluded: ${result.excluded.length} file${result.excluded.length === 1 ? "" : "s"}`);
  lines.push(`context: ${result.sliceTokens}/${result.totalTokens} tokens — ${result.savedPct}% fewer`);
  return lines.join("\n");
}

/**
 * Build a ready-to-paste context block for a LocateResult's slice, in ranked
 * order, stopping once adding the next file would exceed `budget` tokens
 * (the anchor file itself is always included even if it alone exceeds
 * budget, so --pack never returns empty).
 */
export function buildPackedContext(result, repo, budget = 40000) {
  const budgetN = Number(budget) > 0 ? Number(budget) : 40000;
  const included = [];
  const dropped = [];
  let used = 0;
  for (const f of result.slice) {
    if (included.length > 0 && used + f.tokens > budgetN) {
      dropped.push(f.rel);
      continue;
    }
    included.push(f);
    used += f.tokens;
  }
  let text = `# Context for: ${result.task}\n# ${included.length} file${included.length === 1 ? "" : "s"}, ~${used} tokens`;
  for (const f of included) {
    text += `\n\n===== ${f.rel} =====\n${repo.files[f.path] ?? ""}`;
  }
  if (dropped.length) {
    text += `\n\n# ${dropped.length} file(s) omitted — exceeded budget of ${budgetN} tokens: ${dropped.join(", ")}`;
  }
  return { text, included, dropped, usedTokens: used, budget: budgetN };
}

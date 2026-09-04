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

// Static/dynamic imports and require() — captures relative and @/ alias specs.
const IMPORT_RE = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g;

// Python imports. Two forms, both of which may name a module inside the Repo:
//
//   from a.b import c        →  a.b   (and a.b.c, when c is itself a module)
//   from .sib import c       →  sibling of the importing file
//   from ..pkg.mod import c  →  one package up
//   import a.b.c             →  a.b.c
//
// Captured as (dots, dotted-path) so the resolver can count leading dots for
// relative depth. `import x` with no dots is kept because a flat layout makes
// `x` a real sibling module; it resolves to null when x is a third-party
// package, which is the same outcome as an unresolvable JS bare specifier.
const PY_FROM_RE = /^[ \t]*from[ \t]+(\.*)([A-Za-z0-9_.]*)[ \t]+import[ \t]/gm;
const PY_IMPORT_RE = /^[ \t]*import[ \t]+([A-Za-z0-9_.]+(?:[ \t]*,[ \t]*[A-Za-z0-9_.]+)*)/gm;

const PY_EXT_RE = /\.py$/;

/** Every extension the Graph builds nodes for. */
const SOURCE_EXT_RE = /\.(tsx?|jsx?|mts|cts|mjs|cjs|py)$/;

const CHARS_PER_TOKEN = 4;

function estimateTokens(text) {
  return Math.max(1, Math.round(text.length / CHARS_PER_TOKEN));
}

function topDir(rel) {
  return rel.includes("/") ? rel.split("/")[0] : "(root)";
}

// TypeScript under NodeNext writes the *output* extension in the specifier, so
// `import "./timed-out.js"` refers to `timed-out.ts` on disk. This is the norm
// for modern ESM packages rather than an edge case: without the rewrite, a
// repository like sindresorhus/got resolves 85 nodes and zero edges — the
// dependency closure, which is the whole product, collapses silently and the
// only symptom is the sparse-graph warning.
const ESM_OUTPUT_TO_SOURCE = [
  [/\.js$/, [".ts", ".tsx"]],
  [/\.jsx$/, [".tsx"]],
  [/\.mjs$/, [".mts"]],
  [/\.cjs$/, [".cts"]],
];

function tryPath(base, files) {
  for (const c of [
    `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.jsx`,
    `${base}/index.ts`, `${base}/index.tsx`, `${base}/index.js`, `${base}/index.jsx`,
    base,
  ]) {
    if (files[c] !== undefined) return c;
  }
  for (const [pattern, extensions] of ESM_OUTPUT_TO_SOURCE) {
    if (!pattern.test(base)) continue;
    for (const extension of extensions) {
      const candidate = base.replace(pattern, extension);
      if (files[candidate] !== undefined) return candidate;
    }
  }
  return null;
}

/**
 * Resolve an import spec against the repo's flat file map. The `@/` alias maps
 * to different bases across repos (repo root, or `src/`), and the inferred
 * `root` can be empty — so try each plausible base and take the first hit.
 * (Mirrors src/lib/localizer.ts resolve — keep in sync.)
 */
function resolve(spec, fromPath, root, files, packages, aliases) {
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
  const aliased = aliases ? resolveAlias(spec, files, aliases) : null;
  if (aliased) return aliased;
  return packages ? resolveWorkspace(spec, files, packages) : null;
}

/**
 * Resolve a Python module reference to a file in the Repo.
 *
 * `dots` is the leading-dot count: 0 is absolute (rooted at the Repo, or at its
 * source root), 1 is the importing file's own package, 2 is one package up.
 * A dotted path becomes a directory path, then either `mod.py` or the package's
 * `__init__.py`.
 *
 * Returns null for anything not in the Repo, which is how a third-party package
 * such as `stripe` stops being an edge — the same outcome a bare JS specifier
 * already had.
 */
function resolvePython(dots, dotted, fromPath, root, files) {
  const segments = dotted ? dotted.split(".").filter(Boolean) : [];
  const candidateBases = [];

  if (dots > 0) {
    // `.` is the importing file's own directory; each extra dot climbs one.
    const dir = fromPath.split("/").slice(0, -1);
    const base = dir.slice(0, dir.length - (dots - 1));
    candidateBases.push([...base, ...segments].join("/"));
  } else {
    if (segments.length === 0) return null;
    // Absolute: try the Repo root and the inferred source root, the way the
    // `@/` alias already tries several bases.
    for (const prefix of [...new Set(["", root])]) {
      candidateBases.push(prefix ? `${prefix}/${segments.join("/")}` : segments.join("/"));
    }
    // `from a.b import c` may name the module `a.b.c` rather than a symbol in
    // `a.b`, so drop the final segment as a second reading.
    if (segments.length > 1) {
      const parent = segments.slice(0, -1).join("/");
      for (const prefix of [...new Set(["", root])]) {
        candidateBases.push(prefix ? `${prefix}/${parent}` : parent);
      }
    }
  }

  for (const base of candidateBases) {
    if (!base) continue;
    const normalized = normalize(base);
    for (const candidate of [`${normalized}.py`, `${normalized}/__init__.py`]) {
      if (files[candidate] !== undefined) return candidate;
    }
  }
  return null;
}

/**
 * Map every workspace package name in the Repo to its directory.
 *
 * A monorepo writes cross-package imports by package name — `from "swr"`,
 * `from "@acme/utils"` — not by relative path, so without this the dependency
 * Closure stops dead at each package boundary. That is the one place it most
 * needs to continue: a bug that crosses packages is exactly the bug a developer
 * cannot find by reading one directory.
 *
 * Built lazily per Graph and cached on the files object, because `resolve` is
 * called once per import across the whole Repo.
 */
/**
 * Parse a tsconfig/jsconfig, which is JSONC rather than JSON: it may carry
 * comments and trailing commas, and `JSON.parse` rejects both.
 *
 * Tolerant on purpose — a config this cannot read costs the Repo its aliases,
 * so it strips what it can and gives up quietly rather than throwing.
 */
function parseJsonc(text) {
  try {
    const stripped = text
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1")
      .replace(/,(\s*[}\]])/g, "$1");
    return JSON.parse(stripped);
  } catch {
    return null;
  }
}

/**
 * Path aliases declared by the Repo's own tsconfig/jsconfig.
 *
 * `@/` was hardcoded, which covers Next's default and nothing else. A realistic
 * application declaring `~/*`, `@components/*` or `@lib/*` resolved zero imports
 * — the same total graph collapse NodeNext specifiers caused, and applications
 * are exactly who this is for.
 *
 * Returns a list of {prefix, suffix, targets} where a `*` pattern is split
 * around the wildcard; an exact mapping has an empty suffix and matches whole.
 * `extends` is deliberately not followed: it usually points outside the Repo,
 * and a partial alias table beats refusing to read one at all.
 */
function tsconfigAliases(files) {
  const aliases = [];
  for (const p of Object.keys(files)) {
    const name = p.split("/").pop();
    if (name !== "tsconfig.json" && name !== "jsconfig.json") continue;
    const config = parseJsonc(files[p]);
    const options = config?.compilerOptions;
    if (!options) continue;

    const configDir = p.split("/").slice(0, -1).join("/");
    const baseUrl = typeof options.baseUrl === "string" ? options.baseUrl : ".";
    const base = normalize(configDir ? `${configDir}/${baseUrl}` : baseUrl);

    const paths = options.paths;
    if (paths && typeof paths === "object") {
      for (const [pattern, targets] of Object.entries(paths)) {
        if (!Array.isArray(targets)) continue;
        const star = pattern.indexOf("*");
        const resolved = targets
          .filter((t) => typeof t === "string")
          .map((t) => normalize(base ? `${base}/${t.replace("*", "")}` : t.replace("*", "")));
        if (!resolved.length) continue;
        aliases.push(
          star === -1
            ? { prefix: pattern, suffix: "", exact: true, targets: resolved }
            : { prefix: pattern.slice(0, star), suffix: pattern.slice(star + 1), exact: false, targets: resolved },
        );
      }
    }

    // baseUrl alone makes a non-relative specifier resolvable: with
    // `baseUrl: "src"`, `import "lib/util"` means `src/lib/util`.
    if (typeof options.baseUrl === "string") {
      aliases.push({ prefix: "", suffix: "", exact: false, baseOnly: true, targets: [base] });
    }
  }
  // Longest prefix first, so `@lib/` wins over a bare baseUrl fallback.
  return aliases.sort((a, b) => b.prefix.length - a.prefix.length);
}

/** Resolve a specifier through the Repo's declared aliases. */
function resolveAlias(spec, files, aliases) {
  for (const alias of aliases) {
    let rest;
    if (alias.exact) {
      if (spec !== alias.prefix) continue;
      rest = "";
    } else if (alias.baseOnly) {
      rest = spec;
    } else {
      if (!spec.startsWith(alias.prefix) || !spec.endsWith(alias.suffix)) continue;
      rest = spec.slice(alias.prefix.length, spec.length - alias.suffix.length);
    }
    for (const target of alias.targets) {
      const joined = rest ? (target ? `${target}/${rest}` : rest) : target;
      const hit = tryPath(normalize(joined), files);
      if (hit) return hit;
    }
  }
  return null;
}

function workspacePackages(files) {
  const byName = new Map();
  for (const p of Object.keys(files)) {
    if (!p.endsWith("package.json")) continue;
    let manifest;
    try {
      manifest = JSON.parse(files[p]);
    } catch {
      continue;
    }
    if (typeof manifest?.name !== "string" || !manifest.name) continue;
    const dir = p.split("/").slice(0, -1).join("/");
    // Shallowest wins: the root manifest should not shadow a package that
    // happens to share a name prefix.
    const existing = byName.get(manifest.name);
    if (existing === undefined || dir.length < existing.length) byName.set(manifest.name, dir);
  }
  return byName;
}

/**
 * Resolve a bare specifier that names a workspace package in this Repo.
 *
 * `swr` and `swr/infinite` both resolve: the first to the package's own entry,
 * the second to the subpath inside it. A specifier naming a package that is not
 * in the Repo returns null, so a genuine third-party dependency is still not an
 * edge.
 */
function resolveWorkspace(spec, files, packages) {
  if (!packages.size) return null;
  const parts = spec.split("/");
  // Scoped names take two segments (@acme/utils); unscoped take one.
  const nameLength = spec.startsWith("@") ? 2 : 1;
  const name = parts.slice(0, nameLength).join("/");
  const dir = packages.get(name);
  if (dir === undefined) return null;

  const subpath = parts.slice(nameLength).join("/");
  const bases = subpath
    ? [`${dir}/${subpath}`, `${dir}/src/${subpath}`]
    : [`${dir}/src/index`, `${dir}/index`, `${dir}/src`];
  for (const base of bases) {
    const hit = tryPath(normalize(base), files);
    if (hit) return hit;
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

function tokens(text) {
  return text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3);
}

/** Build the deterministic dependency graph from the file map. */
export function buildGraph(repo) {
  const { files, root } = repo;
  const paths = Object.keys(files).filter((p) => SOURCE_EXT_RE.test(p));
  const packages = workspacePackages(files);
  const aliases = tsconfigAliases(files);
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
    // Surfaces stay a JavaScript/TypeScript concept. Next's `app/**/page.tsx`
    // is a structural convention that can be detected; Python web frameworks
    // route through decorators and registries, which would have to be guessed.
    // CONTEXT.md requires Surfaces be discovered structurally, so Python files
    // simply have none and anchor on path and source like any other file.
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
    const addEdge = (tgt) => {
      if (tgt && tgt !== p && byPath[tgt] && !seen.has(tgt)) {
        seen.add(tgt);
        deps[p].push(tgt);
        (rdeps[tgt] ??= []).push(p);
        edges.push({ from: p, to: tgt });
      }
    };

    if (PY_EXT_RE.test(p)) {
      let pm;
      PY_FROM_RE.lastIndex = 0;
      while ((pm = PY_FROM_RE.exec(files[p]))) {
        addEdge(resolvePython(pm[1].length, pm[2], p, root, files));
      }
      PY_IMPORT_RE.lastIndex = 0;
      while ((pm = PY_IMPORT_RE.exec(files[p]))) {
        for (const spec of pm[1].split(",")) {
          const dotted = spec.trim().split(/\s+as\s+/)[0];
          addEdge(resolvePython(0, dotted, p, root, files));
        }
      }
      continue;
    }

    let m;
    IMPORT_RE.lastIndex = 0;
    while ((m = IMPORT_RE.exec(files[p]))) {
      const tgt = resolve(m[1], p, root, files, packages, aliases);
      // `resolve` returns any key present in `files`, but nodes exist only for
      // JS/TS paths, so a `./x.module.css` or `./config.json` import resolves to
      // a path with no node. Every consumer of the graph assumes an edge endpoint
      // has one; `locate` dereferences `byPath[p].rel`, so an edge to a
      // non-node is not a weaker edge, it is a crash. Drop it here rather than
      // guarding each consumer.
      if (tgt && tgt !== p && byPath[tgt] && !seen.has(tgt)) {
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

// Below this many dependency edges per node, the graph is too sparse for the
// Slice size to mean what it appears to mean. Kept here so every surface that
// renders a saving uses the same threshold rather than its own copy.
const SPARSE_EDGE_DENSITY = 0.6;

function graphDensity(graph) {
  return graph.edges.length / Math.max(1, graph.nodes.length);
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
  "app", "code", "file", "files", "thing", "stuff", "please", "now", "here",
  "also", "like", "look", "looks", "into", "from", "but", "its", "been", "have", "has",
  "was", "were", "will", "being", "had", "having", "did", "doing", "about", "than",
  "very", "too", "only", "then", "there", "these", "those", "each", "every", "all",
  "any", "both", "few", "more", "most", "other", "still", "such", "new", "old",
  "see", "try", "use", "run", "set", "put", "move", "give", "take", "come", "going",
  "think", "know", "work", "seems", "seem", "maybe", "sure", "really", "currently"]);

function taskWords(task) {
  // Require length >= 3 so short substrings ("me", "hi") can't false-match
  // ("me" inside "home"). Feature words are effectively always >= 3 chars.
  return new Set(tokens(task).filter((word) => !STOP.has(word)));
}

function scoreAnchor(words, route, rel, source) {
  const pathTokens = new Set(tokens(`${route} ${rel}`));
  const sourceTokens = new Set(tokens(source));
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
  return {
    score,
    pathMatches,
    matchedWords: matchedWords.size,
    matchedTerms: [...matchedWords],
  };
}

const REPOSITORY_TERM_STOP = new Set([
  ...STOP,
  "src", "server", "client", "components", "component", "lib", "api",
  "route", "page", "index", "test", "tests", "spec", "typescript", "javascript",
]);

function repositoryTerms(graph) {
  const counts = new Map();
  for (const node of graph.nodes) {
    for (const term of new Set(tokens(node.rel))) {
      if (REPOSITORY_TERM_STOP.has(term)) continue;
      counts.set(term, (counts.get(term) ?? 0) + 1);
    }
  }
  return [...counts]
    .sort(([termA, countA], [termB, countB]) => countB - countA || termA.localeCompare(termB))
    .slice(0, 8)
    .map(([term]) => term);
}

/**
 * Localize a task to the minimal relevant slice of the repo.
 * Conservative localization: if no file anchors with enough task evidence,
 * fall back to the whole repo instead of returning a speculative small slice.
 */
/**
 * The implementation a test file covers: `lib/admission.test.ts` -> `lib/admission.ts`.
 *
 * Returns null for anything that is not a test file, or whose counterpart is not
 * in the Repo.
 */
function implementationUnderTest(path, byPath) {
  const match = /^(.*)\.(test|spec)\.(ts|tsx|js|jsx|mts|mjs)$/.exec(path);
  if (!match) return null;
  const [, stem] = match;
  for (const extension of [".ts", ".tsx", ".js", ".jsx", ".mts", ".mjs"]) {
    const candidate = `${stem}${extension}`;
    if (byPath[candidate]) return candidate;
  }
  return null;
}

export function locate(task, repo, graph, evidence = "") {
  const { deps, rdeps, byPath } = graph;
  const recent = new Set(repo.recentlyChanged);
  const words = taskWords(`${task}\n${evidence}`);

  const ranked = graph.nodes
    .map((node) => ({
      path: node.path,
      route: node.route ?? "",
      recent: recent.has(node.path),
      ...scoreAnchor(words, node.route ?? "", node.rel, repo.files[node.path] ?? ""),
    }))
    .sort((a, b) => b.score - a.score || b.matchedWords - a.matchedWords);
  const scored = ranked.filter(
    (candidate) => candidate.pathMatches > 0 || candidate.matchedWords >= 2,
  );
  const best = scored[0]?.score ?? 0;

  if (!task.trim() || best < 3) {
    const topCandidates = ranked.filter((candidate) => candidate.score > 0).slice(0, 3);
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
      anchorPaths: [],
      slice,
      excluded: [],
      excludedPaths: [],
      sliceTokens: graph.totalTokens,
      totalTokens: graph.totalTokens,
      savedPct: 0,
      refinement: {
        unmatchedTerms: [...words].filter(
          (word) => !ranked.some((candidate) => candidate.matchedTerms.includes(word)),
        ),
        candidateFiles: topCandidates.map((candidate) => byPath[candidate.path].rel),
        candidateFilePaths: topCandidates.map((candidate) => candidate.path),
        repositoryTerms: repositoryTerms(graph),
      },
      edgeDensity: graphDensity(graph),
      sparse: graphDensity(graph) < SPARSE_EDGE_DENSITY,
    };
  }

  const selected = scored
    .filter((s) =>
      s.score >= Math.max(3, best - 1) ||
      (s.score >= 3 && s.matchedWords >= Math.min(3, words.size)) ||
      (s.recent && s.matchedWords >= 2),
    )
    .slice(0, 6);

  // A test file that anchors drags in the implementation it covers.
  //
  // Tests are written in behavioural prose — "returns the wrong capability" —
  // so they match the language of a task better than the code they cover, which
  // is written in the language of the solution. Measured on this repository, the
  // four highest-scoring files for a task about the tier resolver were all test
  // files, and the resolver itself placed eleventh and fell outside the six-anchor
  // cap. An agent handed that Slice gets the tests for the bug and not the code.
  //
  // Pairing rather than penalising tests: a task can legitimately be about a test,
  // and the fix for a described behaviour is almost always in both files anyway.
  const anchorPathSet = new Set(selected.map((s) => s.path));
  for (const candidate of selected) {
    const implementation = implementationUnderTest(candidate.path, byPath);
    if (implementation && !anchorPathSet.has(implementation)) {
      anchorPathSet.add(implementation);
    }
  }
  const anchors = [...anchorPathSet].map(
    (path) => scored.find((s) => s.path === path)
      ?? ranked.find((s) => s.path === path)
      ?? { path },
  );
  const dist = {};
  for (const a of anchors) {
    for (const [f, d] of Object.entries(closure(a.path, deps))) {
      dist[f] = Math.min(dist[f] ?? 99, d);
    }
    if (!byPath[a.path].isSurface) {
      for (const consumer of rdeps[a.path] ?? []) {
        dist[consumer] = Math.min(dist[consumer] ?? 99, 1);
      }
    }
  }
  const sliceFiles = Object.keys(dist).map((p) => ({
    path: p, rel: byPath[p].rel, dist: dist[p], tokens: byPath[p].tokens, recent: recent.has(p),
  }));
  // rank: Anchors first, then recently-changed (cross-cutting), then distance.
  //
  // Recency used to be the primary key, which meant any recently-touched file
  // outranked every Anchor. Measured here: nine unrelated files sorted above four
  // of the six Anchors, and the Anchor the task was actually about fell outside a
  // 30,000-token pack while four of its test files stayed in. Ranking decides what
  // survives a budget, so that is not a display detail — it is the Slice the agent
  // receives.
  //
  // Anchors are the files that matched the task. Nothing that merely changed
  // recently should displace them. Below the Anchors the documented order is
  // untouched, so a recently-changed shared util still floats above its
  // same-distance neighbours, which is the cross-cutting case Recent signal exists
  // for.
  sliceFiles.sort((a, b) =>
    Number(b.dist === 0) - Number(a.dist === 0)
    || Number(b.recent) - Number(a.recent)
    || a.dist - b.dist
    || a.rel.localeCompare(b.rel),
  );
  const inSlice = new Set(Object.keys(dist));
  const excludedNodes = graph.nodes.filter((n) => !inSlice.has(n.path));
  const excluded = excludedNodes.map((n) => n.rel);
  const sliceTokens = sliceFiles.reduce((s, f) => s + f.tokens, 0);
  return {
    task,
    widened: false,
    reason: `matched ${anchors.map((a) => a.path).join(", ")}`,
    anchors: anchors.map((a) => byPath[a.path].rel),
    anchorPaths: anchors.map((a) => a.path),
    slice: sliceFiles,
    excluded,
    excludedPaths: excludedNodes.map((n) => n.path),
    sliceTokens,
    totalTokens: graph.totalTokens,
    savedPct: Math.round((100 * (graph.totalTokens - sliceTokens)) / graph.totalTokens),
    refinement: null,
    edgeDensity: graphDensity(graph),
    sparse: graphDensity(graph) < SPARSE_EDGE_DENSITY,
  };
}

// ---------------------------------------------------------------------------
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
  // everything, having returned nothing. The hosted API already refuses this
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

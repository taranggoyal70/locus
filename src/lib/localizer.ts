import type {
  Graph,
  GraphNode,
  LocateResult,
  RepoData,
  SliceFile,
} from "@/lib/types";

// Static/dynamic imports and require() — captures relative and @/ alias specs.
const IMPORT_RE = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"](@\/[^'"]+|\.[^'"]+)['"]/g;

function estimateTokens(text: string): number {
  return Math.max(1, Math.round(text.length / 4));
}

function topDir(rel: string): string {
  // Loose files with no directory group under one "(root)" column, rather than
  // each becoming its own fake column headed by the filename.
  return rel.includes("/") ? rel.split("/")[0] : "(root)";
}

/** Try a base path against the file map with the usual resolution order. */
function tryPath(base: string, files: Record<string, string>): string | null {
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
 * to different bases across repos (repo root, or `src/`), and our inferred
 * `root` can be empty when files live at the top level — so try each plausible
 * base and take the first hit. This is what lets real repos build a full graph
 * instead of a sparse one (a sparse graph silently inflates the token saving).
 */
function resolve(
  spec: string,
  fromPath: string,
  root: string,
  files: Record<string, string>,
): string | null {
  if (spec.startsWith("@/")) {
    const rest = spec.slice(2);
    const prefixes = [...new Set([root, "src", ""])];
    for (const p of prefixes) {
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

function normalize(p: string): string {
  const parts: string[] = [];
  for (const seg of p.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return parts.join("/");
}

function tokens(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3);
}

/** Build the deterministic dependency graph from the file map. */
export function buildGraph(repo: RepoData): Graph {
  const { files, root } = repo;
  const paths = Object.keys(files).filter((p) => /\.(tsx?|jsx?)$/.test(p));
  const nodes: GraphNode[] = [];
  const byPath: Record<string, GraphNode> = {};
  const deps: Record<string, string[]> = {};
  const rdeps: Record<string, string[]> = {};
  const edges: { from: string; to: string }[] = [];
  const surfaces: { route: string; path: string }[] = [];

  for (const p of paths) {
    deps[p] = [];
    rdeps[p] = rdeps[p] ?? [];
  }

  for (const p of paths) {
    const rel = p.startsWith(root + "/") ? p.slice(root.length + 1) : p;
    const isSurface = /^app\/.+\/page\.(tsx?|jsx?)$/.test(rel) || /^app\/page\.(tsx?|jsx?)$/.test(rel);
    let route: string | undefined;
    if (isSurface) {
      route =
        rel.replace(/^app\//, "").replace(/\/page\.(tsx?|jsx?)$/, "").replace(/page\.(tsx?|jsx?)$/, "") ||
        "home";
      surfaces.push({ route, path: p });
    }
    const node: GraphNode = {
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
    const seen = new Set<string>();
    let m: RegExpExecArray | null;
    IMPORT_RE.lastIndex = 0;
    while ((m = IMPORT_RE.exec(files[p]))) {
      const tgt = resolve(m[1], p, root, files);
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

function graphDensity(graph: Graph): number {
  return graph.edges.length / Math.max(1, graph.nodes.length);
}

/** BFS transitive dependency closure of an anchor, with distances. */
function closure(anchor: string, deps: Record<string, string[]>, maxDepth = 8): Record<string, number> {
  const dist: Record<string, number> = { [anchor]: 0 };
  const q = [anchor];
  while (q.length) {
    const cur = q.shift()!;
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

function taskWords(task: string): Set<string> {
  // Require length >= 3 so short substrings ("me", "hi") can't false-match
  // ("me" inside "home"). Feature words are effectively always >= 3 chars.
  return new Set(tokens(task).filter((word) => !STOP.has(word)));
}

function scoreAnchor(words: Set<string>, route: string, rel: string, source: string) {
  const pathTokens = new Set(tokens(`${route} ${rel}`));
  const sourceTokens = new Set(tokens(source));
  let score = 0;
  let pathMatches = 0;
  const matchedWords = new Set<string>();
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
    // Source text is weaker evidence than a path, but it lets concrete tasks
    // find hooks, API handlers, and libraries that are not route entry points.
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

function repositoryTerms(graph: Graph): string[] {
  const counts = new Map<string, number>();
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
function implementationUnderTest(
  path: string,
  byPath: Record<string, GraphNode>,
): string | null {
  const match = /^(.*)\.(test|spec)\.(ts|tsx|js|jsx|mts|mjs)$/.exec(path);
  if (!match) return null;
  const stem = match[1];
  for (const extension of [".ts", ".tsx", ".js", ".jsx", ".mts", ".mjs"]) {
    const candidate = `${stem}${extension}`;
    if (byPath[candidate]) return candidate;
  }
  return null;
}

export function locate(task: string, repo: RepoData, graph: Graph, evidence = ""): LocateResult {
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
    // Widened: still rank recently-changed files first — that's precisely when a
    // user scanning the whole repo most wants the Recent signal surfaced.
    const slice = graph.nodes
      .map((n) => ({ path: n.path, rel: n.rel, dist: 0, tokens: n.tokens, recent: recent.has(n.path) }))
      .sort((a, b) => Number(b.recent) - Number(a.recent) || a.rel.localeCompare(b.rel));
    const topCandidates = ranked.filter((candidate) => candidate.score > 0).slice(0, 3);
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

  // Keep a small set of near-tied anchors. This matters for changes such as a
  // theme bug that legitimately spans a provider, toggle, and layout. A weaker
  // matching page must not displace a stronger API/library anchor.
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
  const dist: Record<string, number> = {};
  for (const a of anchors) {
    for (const [f, d] of Object.entries(closure(a.path, deps))) {
      dist[f] = Math.min(dist[f] ?? 99, d);
    }
    // A library/hook/API file's immediate consumers contain the integration
    // points an agent usually needs. Keep the consumer itself, but do not pull
    // all of its other dependencies: the anchor closure already supplies the
    // relevant side of the integration.
    if (!byPath[a.path].isSurface) {
      for (const consumer of rdeps[a.path] ?? []) {
        dist[consumer] = Math.min(dist[consumer] ?? 99, 1);
      }
    }
  }
  const sliceFiles: SliceFile[] = Object.keys(dist).map((p) => ({
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

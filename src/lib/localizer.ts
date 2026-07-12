import type {
  Graph,
  GraphNode,
  LocateResult,
  RepoData,
  SliceFile,
} from "@/lib/types";

// Any relative or alias import spec. We ignore bare package imports (react, …).
const IMPORT_RE = /['"](@\/[^'"]+|\.[^'"]+)['"]/g;

function estimateTokens(text: string): number {
  return Math.max(1, Math.round(text.length / 4));
}

function topDir(rel: string): string {
  const first = rel.split("/")[0];
  return first || "root";
}

/** Try a base path against the file map with the usual TS resolution order. */
function tryPath(base: string, files: Record<string, string>): string | null {
  for (const c of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`, base]) {
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

/** Build the deterministic dependency graph from the file map. */
export function buildGraph(repo: RepoData): Graph {
  const { files, root } = repo;
  const paths = Object.keys(files).filter((p) => /\.(ts|tsx)$/.test(p));
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
    const isSurface = /^app\/.+\/page\.(ts|tsx)$/.test(rel) || rel === "app/page.tsx";
    let route: string | undefined;
    if (isSurface) {
      route =
        rel.replace(/^app\//, "").replace(/\/page\.(ts|tsx)$/, "").replace(/page\.(ts|tsx)$/, "") ||
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
  "app", "code", "file", "files", "thing", "stuff", "please", "now", "here"]);

function taskWords(task: string): Set<string> {
  // Require length >= 3 so short substrings ("me", "hi") can't false-match
  // ("me" inside "home"). Feature words are effectively always >= 3 chars.
  return new Set(
    task.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w)),
  );
}

function scoreAnchor(words: Set<string>, route: string, rel: string): number {
  const hay = new Set(
    (route + " " + rel).toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3),
  );
  let s = 0;
  for (const w of words) {
    for (const h of hay) {
      if (w === h) s += 2; // exact token match
      // prefix match for morphology ("dashboards" ~ "dashboard"), min length 4
      // and prefix-anchored so mid-word substrings never match.
      else if ((w.length >= 4 && h.startsWith(w)) || (h.length >= 4 && w.startsWith(h))) s += 1;
    }
  }
  return s;
}

/**
 * Localize a task to the minimal relevant slice of the repo.
 * Widen-not-narrow: if no surface anchors with confidence, fall back to the
 * whole repo (worst case = baseline, never a silent miss).
 */
export function locate(task: string, repo: RepoData, graph: Graph): LocateResult {
  const { deps, byPath, surfaces } = graph;
  const recent = new Set(repo.recentlyChanged);
  const words = taskWords(task);

  const scored = surfaces
    .map((s) => ({ ...s, score: scoreAnchor(words, s.route, byPath[s.path].rel) }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0]?.score ?? 0;

  if (!task.trim() || best <= 0) {
    const all = graph.nodes.map((n) => n.rel);
    return {
      task,
      widened: true,
      reason: task.trim()
        ? "no route matched the task — widened to the whole repo (never miss)"
        : "type a task to localize",
      anchors: [],
      slice: graph.nodes.map((n) => ({
        path: n.path, rel: n.rel, dist: 0, tokens: n.tokens, recent: recent.has(n.path),
      })),
      excluded: [],
      sliceTokens: graph.totalTokens,
      totalTokens: graph.totalTokens,
      savedPct: 0,
    };
  }

  const anchors = scored.filter((s) => s.score === best);
  const dist: Record<string, number> = {};
  for (const a of anchors) {
    for (const [f, d] of Object.entries(closure(a.path, deps))) {
      dist[f] = Math.min(dist[f] ?? 99, d);
    }
  }
  const sliceFiles: SliceFile[] = Object.keys(dist).map((p) => ({
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
    reason: `anchored on ${anchors.map((a) => byPath[a.path].rel).join(", ")}`,
    anchors: anchors.map((a) => byPath[a.path].rel),
    slice: sliceFiles,
    excluded,
    sliceTokens,
    totalTokens: graph.totalTokens,
    savedPct: Math.round((100 * (graph.totalTokens - sliceTokens)) / graph.totalTokens),
  };
}

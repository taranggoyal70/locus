import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { track } from "@/lib/analytics";
import { consumeRateLimit } from "@/lib/rate-limit";
import { sameOriginMutation } from "@/lib/request-security";
import type { RepoData } from "@/lib/types";

// Fetch a public GitHub repo's TypeScript source into the flat {path: content}
// shape the localizer uses. GitHub API calls cover metadata, ref resolution,
// tree listing, and recent-change metadata; file contents come from
// raw.githubusercontent (not API-rate-limited). Capped so arbitrary repos stay
// responsive.
const MAX_FILES = 200;
const MAX_FILE_BYTES = 100_000;
const MAX_TOTAL_BYTES = 5_000_000;
const MAX_BODY_BYTES = 1_024;
const FETCH_TIMEOUT_MS = 8_000;
const DOWNLOAD_CONCURRENCY = 8;
const RATE_LIMIT = 6;
const SRC_RE = /\.(tsx?|jsx?)$/;
const IGNORE = /(^|\/)(node_modules|\.next|dist|build|\.git|vendor|tests?|__tests__|e2e)\//i;

function ghHeaders() {
  const h: Record<string, string> = { Accept: "application/vnd.github+json" };
  const token = process.env.GITHUB_TOKEN;
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}

function fetchWithTimeout(url: string, init?: RequestInit) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
}

async function readLimitedBody(request: Request): Promise<{ text?: string; tooLarge: boolean }> {
  if (!request.body) return { text: "", tooLarge: false };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return { tooLarge: true };
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { text: new TextDecoder().decode(bytes), tooLarge: false };
}

async function mapConcurrent<T, R>(items: T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await work(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function parseRepo(input: string): { owner: string; repo: string; ref?: string } | null {
  const value = input.trim();
  const short = value.match(/^([\w.-]+)\/([\w.-]+?)(?:@([\w./-]+))?$/);
  if (short) {
    return {
      owner: short[1],
      repo: short[2].replace(/\.git$/, ""),
      ref: short[3],
    };
  }

  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    if (url.hostname !== "github.com" && url.hostname !== "www.github.com") return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/, "");
    const ref = parts[2] === "tree" && parts.length > 3 ? parts.slice(3).join("/") : undefined;
    if (![owner, repo].every((part) => /^[\w.-]+$/.test(part))) return null;
    if (ref && !/^[\w./-]+$/.test(ref)) return null;
    return { owner, repo, ref };
  } catch {
    return null;
  }
}

/**
 * A cold web load can spend 9 GitHub API calls: metadata, ref resolution, the
 * file tree, a commit list, and five commit details for the recent-change
 * signal. At the per-user limit of 6 loads a minute that is 3,240 calls an hour
 * from one user, against an authenticated ceiling of 5,000 an hour that every
 * user of this deployment shares because the token is the server's. Two people
 * importing steadily exhaust it.
 *
 * The expensive source payload is cached only after GitHub has resolved the
 * requested ref to the current commit. Metadata is rebuilt on every request so a
 * repository turning private is refused immediately and request-specific fields
 * such as name/slug still match the input shape. A cache hit still spends 2
 * GitHub API calls for visibility metadata and ref resolution before the cache
 * read.
 *
 * Per-instance and short-lived on purpose. It removes the repeat-load storm,
 * which is the realistic exhaustion path; it is not a cross-instance cache. A
 * shared cache (Vercel Runtime Cache) would be stronger and needs its own
 * design decision about invalidation.
 *
 * Scoped to web imports only. `POST /api/v1/locate` is a second repository
 * loading path through its own `fetchRepo` and is deliberately not routed
 * through this cache, so an API-key caller can still spend the shared server
 * token on repeat loads of the same repository. That path is tracked as an open
 * residual in `docs/operations/security-review-status.md` rather than closed here: it
 * rechecks repository visibility on every request and authenticates differently,
 * so putting both behind one loading boundary is a design change, not a cache.
 */
const REPO_CACHE_TTL_MS = 5 * 60 * 1000;
const REPO_CACHE_MAX_ENTRIES = 25;

type CachedRepoSource = {
  root: string;
  recentlyChanged: string[];
  files: Record<string, string>;
  truncated: boolean;
  fileCount: number;
  expiresAt: number;
};

const repoCache = new Map<string, CachedRepoSource>();

function repoCacheKey(owner: string, repo: string, revision: string): string {
  // GitHub treats owner and repository names case-insensitively, so fold them to
  // avoid caching the same repository under several keys.
  return `${owner.toLowerCase()}/${repo.toLowerCase()}@${revision}`;
}

function readRepoCache(key: string): CachedRepoSource | null {
  const hit = repoCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    repoCache.delete(key);
    return null;
  }
  // Refresh insertion order so the least recently used entry is evicted first.
  repoCache.delete(key);
  repoCache.set(key, hit);
  return hit;
}

function writeRepoCache(key: string, value: Omit<CachedRepoSource, "expiresAt">): void {
  repoCache.set(key, { ...value, expiresAt: Date.now() + REPO_CACHE_TTL_MS });
  while (repoCache.size > REPO_CACHE_MAX_ENTRIES) {
    const oldest = repoCache.keys().next();
    if (oldest.done) break;
    repoCache.delete(oldest.value);
  }
}

/** Exposed for tests: cached repositories must not leak between cases. */
export function clearRepoCacheForTests(): void {
  repoCache.clear();
}

function rawPath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function buildRepoData(
  owner: string,
  repo: string,
  ref: string | undefined,
  resolvedRevision: string,
  description: unknown,
  source: Pick<CachedRepoSource, "root" | "recentlyChanged" | "files">,
): RepoData {
  return {
    name: `${owner}/${repo}${ref ? `@${resolvedRevision.slice(0, 7)}` : ""}`,
    slug: `${owner}-${repo}${ref ? `-${resolvedRevision.slice(0, 7)}` : ""}`,
    description: typeof description === "string" && description ? description : `${owner}/${repo}`,
    root: source.root,
    recentlyChanged: source.recentlyChanged,
    files: source.files,
  };
}

/**
 * Longest common directory prefix — used as the source root. Top-level loose
 * files (e.g. next.config.ts, middleware.ts) are EXCLUDED from the computation:
 * otherwise a single root-level file collapses a real `src/` root to "", which
 * makes buildGraph find zero Surfaces and silently widen every task. (Mirrors
 * the CLI's commonDirPrefix in bin/core.mjs — keep in sync.)
 */
function commonRoot(paths: string[]): string {
  const split = paths.map((p) => p.split("/").slice(0, -1)).filter((segs) => segs.length > 0);
  if (!split.length) return "";
  let prefix = split[0];
  for (const parts of split) {
    let i = 0;
    while (i < prefix.length && i < parts.length && prefix[i] === parts[i]) i++;
    prefix = prefix.slice(0, i);
  }
  return prefix.join("/");
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let rateHeaders = {
    "X-RateLimit-Limit": String(RATE_LIMIT),
    "X-RateLimit-Remaining": String(RATE_LIMIT),
  } as Record<string, string>;

  if (!sameOriginMutation(request)) {
    return NextResponse.json(
      { error: "Cross-site requests are not allowed.", code: "invalid" },
      { status: 403, headers: rateHeaders },
    );
  }

  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "Content-Type must be application/json." }, { status: 415, headers: rateHeaders });
  }
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request body is too large." }, { status: 413, headers: rateHeaders });
  }

  try {
    const rawBody = await readLimitedBody(request);
    if (rawBody.tooLarge) {
      return NextResponse.json({ error: "Request body is too large." }, { status: 413, headers: rateHeaders });
    }
    let body: unknown;
    try {
      body = JSON.parse(rawBody.text ?? "");
    } catch {
      return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400, headers: rateHeaders });
    }
    const url = typeof body === "object" && body !== null && "url" in body
      ? (body as { url?: unknown }).url
      : undefined;
    if (typeof url !== "string" || url.length > 300) {
      return NextResponse.json({ error: "Enter a valid GitHub repository." }, { status: 400, headers: rateHeaders });
    }
    const parsed = parseRepo(url);
    if (!parsed) {
      return NextResponse.json({ error: "Enter owner/repo, owner/repo@commit, or a GitHub URL." }, { status: 400, headers: rateHeaders });
    }
    const { owner, repo, ref } = parsed;

    let rate;
    try {
      rate = await consumeRateLimit({
        namespace: "github-repository-read",
        identity: clientIp(request),
        limit: RATE_LIMIT,
        windowSeconds: 60,
      });
    } catch {
      return NextResponse.json(
        { error: "Repo request limits could not be verified. Try again shortly.", code: "temporary" },
        { status: 503 },
      );
    }
    rateHeaders = {
      "X-RateLimit-Limit": String(RATE_LIMIT),
      "X-RateLimit-Remaining": String(rate.remaining),
    };
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many repository requests. Try again shortly.", code: "rate-limited" },
        { status: 429, headers: { ...rateHeaders, "Retry-After": String(rate.retryAfterSeconds) } },
      );
    }

    const info = await fetchWithTimeout(`https://api.github.com/repos/${owner}/${repo}`, { headers: ghHeaders() });
    if (info.status === 404) {
      return NextResponse.json(
        {
          error: "Repo not found. Controlled alpha currently supports public repositories only.",
          code: "unavailable",
        },
        { status: 404, headers: rateHeaders },
      );
    }
    if (!info.ok) return NextResponse.json({ error: `GitHub error (${info.status}). Try again later.` }, { status: 502 });
    const meta = await info.json().catch(() => null);
    if (!meta || typeof meta !== "object") {
      return NextResponse.json({ error: "GitHub returned an invalid repository response." }, { status: 502, headers: rateHeaders });
    }
    if (meta.private === true || (typeof meta.visibility === "string" && meta.visibility !== "public")) {
      return NextResponse.json(
        { error: "Controlled alpha supports public repositories only.", code: "unavailable" },
        { status: 403, headers: rateHeaders },
      );
    }
    const revision = ref || meta.default_branch || "main";

    const commitRes = await fetchWithTimeout(
      `https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(revision)}`,
      { headers: ghHeaders() },
    );
    if (commitRes.status === 404) {
      return NextResponse.json(
        { error: `Commit or branch “${revision}” was not found.`, code: "invalid" },
        { status: 404, headers: rateHeaders },
      );
    }
    if (!commitRes.ok) return NextResponse.json({ error: "Could not resolve the repository revision." }, { status: 502 });
    const commit = await commitRes.json().catch(() => null);
    const resolvedRevision = typeof commit?.sha === "string" ? commit.sha : "";
    const treeSha = typeof commit?.commit?.tree?.sha === "string" ? commit.commit.tree.sha : "";
    if (!resolvedRevision || !treeSha) {
      return NextResponse.json({ error: "GitHub returned an invalid repository revision." }, { status: 502, headers: rateHeaders });
    }
    const cacheKey = repoCacheKey(owner, repo, resolvedRevision);
    const cached = readRepoCache(cacheKey);
    if (cached) {
      // Metadata is rebuilt per request rather than served from the cache, so
      // name, slug and description match this request rather than the one that
      // filled the entry.
      const repoData = buildRepoData(owner, repo, ref, resolvedRevision, meta.description, cached);
      // The metric means "a user successfully loaded a repository", so a hit has
      // to count. Emitting only on a miss would make `Repos loaded (30d)` quietly
      // become "cache misses" and undercount exactly the repeat loads this cache
      // was added to serve.
      track({
        event: "repo_loaded",
        userId,
        properties: {
          files: cached.fileCount,
          truncated: cached.truncated,
          cached: true,
        },
      });
      return NextResponse.json(
        { repo: repoData, truncated: cached.truncated, fileCount: cached.fileCount },
        { headers: rateHeaders },
      );
    }

    const treeRes = await fetchWithTimeout(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(treeSha)}?recursive=1`,
      { headers: ghHeaders() },
    );
    if (!treeRes.ok) return NextResponse.json({ error: "Could not read the repo file tree." }, { status: 502 });
    const tree = await treeRes.json().catch(() => null);
    if (!tree || typeof tree !== "object" || !Array.isArray(tree.tree)) {
      return NextResponse.json({ error: "GitHub returned an invalid repository tree." }, { status: 502, headers: rateHeaders });
    }

    const candidates = (tree.tree as { path: string; type: string; size?: number }[])
      .filter((n) => n.type === "blob" && SRC_RE.test(n.path) && !IGNORE.test(n.path) && (n.size ?? 0) <= MAX_FILE_BYTES);
    const files: string[] = [];
    let sourceBytes = 0;
    for (const file of candidates) {
      const size = file.size ?? MAX_FILE_BYTES;
      if (files.length >= MAX_FILES || sourceBytes + size > MAX_TOTAL_BYTES) break;
      files.push(file.path);
      sourceBytes += size;
    }
    if (files.length === 0) {
      return NextResponse.json({ error: "No JavaScript or TypeScript source found in that repo." }, { status: 400 });
    }
    const truncated = files.length < candidates.length;

    const entries = await mapConcurrent(files, DOWNLOAD_CONCURRENCY, async (path) => {
      try {
        const r = await fetchWithTimeout(`https://raw.githubusercontent.com/${owner}/${repo}/${resolvedRevision}/${rawPath(path)}`);
        if (!r.ok) return null;
        const bytes = await r.arrayBuffer();
        if (bytes.byteLength > MAX_FILE_BYTES) return null;
        return [path, new TextDecoder().decode(bytes), bytes.byteLength] as const;
      } catch {
        return null;
      }
    });
    const fileMap: Record<string, string> = {};
    let downloadedBytes = 0;
    for (const e of entries) {
      if (!e || downloadedBytes + e[2] > MAX_TOTAL_BYTES) continue;
      fileMap[e[0]] = e[1];
      downloadedBytes += e[2];
    }
    if (Object.keys(fileMap).length === 0) {
      return NextResponse.json({ error: "GitHub returned a file tree, but its source files could not be downloaded." }, { status: 502 });
    }

    // best-effort recent-change signal from the last few commits
    let recentlyChanged: string[] = [];
    try {
      const commits = await fetchWithTimeout(
        `https://api.github.com/repos/${owner}/${repo}/commits?per_page=5&sha=${encodeURIComponent(resolvedRevision)}`,
        { headers: ghHeaders() },
      ).then((r) => (r.ok ? r.json() : []));
      const detail = await Promise.all(
        (commits as { sha: string }[]).slice(0, 5).map((c) =>
          fetchWithTimeout(`https://api.github.com/repos/${owner}/${repo}/commits/${c.sha}`, { headers: ghHeaders() })
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
        ),
      );
      const changed = new Set<string>();
      for (const d of detail) {
        const fs = (d?.files ?? []) as { filename: string }[];
        // skip bulk commits — not a targeted-change signal
        if (fs.length && fs.length <= Math.max(2, Math.floor(0.4 * Object.keys(fileMap).length))) {
          for (const f of fs) {
            if (SRC_RE.test(f.filename) && fileMap[f.filename] !== undefined) changed.add(f.filename);
          }
        }
      }
      recentlyChanged = [...changed];
    } catch {
      recentlyChanged = [];
    }

    const root = commonRoot(Object.keys(fileMap));
    const fileCount = Object.keys(fileMap).length;
    const repoData = buildRepoData(owner, repo, ref, resolvedRevision, meta.description, {
      root,
      recentlyChanged,
      files: fileMap,
    });
    writeRepoCache(cacheKey, {
      root,
      recentlyChanged,
      files: fileMap,
      truncated,
      fileCount,
    });
    track({
      event: "repo_loaded",
      userId,
      properties: {
        files: fileCount,
        truncated,
        cached: false,
      },
    });

    return NextResponse.json(
      { repo: repoData, truncated, fileCount },
      { headers: rateHeaders },
    );
  } catch (error) {
    const { logger } = await import("@/lib/logger");
    logger.error("GitHub repository load failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : "Unknown failure",
    });
    return NextResponse.json(
      { error: "Could not load the repository. Try again later." },
      { status: 500, headers: rateHeaders },
    );
  }
}

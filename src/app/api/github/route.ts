import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { track } from "@/lib/analytics";
import type { RepoData } from "@/lib/types";

// Fetch a public GitHub repo's TypeScript source into the flat {path: content}
// shape the localizer uses. Tree comes from the API (1 call, GITHUB_TOKEN
// optional for higher limits); file contents come from raw.githubusercontent
// (not API-rate-limited). Capped so arbitrary repos stay responsive.
const MAX_FILES = 200;
const MAX_FILE_BYTES = 100_000;
const MAX_TOTAL_BYTES = 5_000_000;
const MAX_BODY_BYTES = 1_024;
const FETCH_TIMEOUT_MS = 8_000;
const DOWNLOAD_CONCURRENCY = 8;
const RATE_LIMIT = 6;
const RATE_WINDOW_MS = 60_000;
const SRC_RE = /\.(tsx?|jsx?)$/;
const IGNORE = /(^|\/)(node_modules|\.next|dist|build|\.git|vendor|tests?|__tests__|e2e)\//i;

type RateEntry = { count: number; resetAt: number };
const rateLimits = new Map<string, RateEntry>();

function ghHeaders() {
  const h: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}

function checkRateLimit(request: Request): { allowed: boolean; remaining: number; retryAfter: number } {
  const now = Date.now();
  const key = clientIp(request);
  const current = rateLimits.get(key);
  const entry = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + RATE_WINDOW_MS }
    : current;
  entry.count += 1;
  rateLimits.set(key, entry);

  // Keep the best-effort in-memory limiter bounded on warm server instances.
  if (rateLimits.size > 10_000) {
    for (const [ip, value] of rateLimits) if (value.resetAt <= now) rateLimits.delete(ip);
  }

  return {
    allowed: entry.count <= RATE_LIMIT,
    remaining: Math.max(0, RATE_LIMIT - entry.count),
    retryAfter: Math.max(1, Math.ceil((entry.resetAt - now) / 1_000)),
  };
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

function rawPath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
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

  const rate = checkRateLimit(request);
  const rateHeaders = {
    "X-RateLimit-Limit": String(RATE_LIMIT),
    "X-RateLimit-Remaining": String(rate.remaining),
  };
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many repository requests. Try again shortly." },
      { status: 429, headers: { ...rateHeaders, "Retry-After": String(rate.retryAfter) } },
    );
  }

  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "Cross-site requests are not allowed." }, { status: 403, headers: rateHeaders });
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

    const info = await fetchWithTimeout(`https://api.github.com/repos/${owner}/${repo}`, { headers: ghHeaders() });
    if (info.status === 404) return NextResponse.json({ error: "Repo not found or is private." }, { status: 404 });
    if (!info.ok) return NextResponse.json({ error: `GitHub error (${info.status}). Try again later.` }, { status: 502 });
    const meta = await info.json().catch(() => null);
    if (!meta || typeof meta !== "object") {
      return NextResponse.json({ error: "GitHub returned an invalid repository response." }, { status: 502, headers: rateHeaders });
    }
    const revision = ref || meta.default_branch || "main";

    const treeRes = await fetchWithTimeout(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(revision)}?recursive=1`,
      { headers: ghHeaders() },
    );
    if (treeRes.status === 404) {
      return NextResponse.json({ error: `Commit or branch “${revision}” was not found.` }, { status: 404 });
    }
    if (!treeRes.ok) return NextResponse.json({ error: "Could not read the repo file tree." }, { status: 502 });
    const tree = await treeRes.json().catch(() => null);
    if (!tree || typeof tree !== "object" || !Array.isArray(tree.tree)) {
      return NextResponse.json({ error: "GitHub returned an invalid repository tree." }, { status: 502, headers: rateHeaders });
    }
    const resolvedRevision = String(tree.sha || revision);

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

    const repoData: RepoData = {
      name: `${owner}/${repo}${ref ? `@${resolvedRevision.slice(0, 7)}` : ""}`,
      slug: `${owner}-${repo}${ref ? `-${resolvedRevision.slice(0, 7)}` : ""}`,
      description: meta.description || `${owner}/${repo}`,
      root: commonRoot(Object.keys(fileMap)),
      recentlyChanged,
      files: fileMap,
    };
    track({
      event: "repo_loaded",
      userId,
      properties: {
        repo: `${owner}/${repo}`,
        files: Object.keys(fileMap).length,
        truncated,
      },
    });

    return NextResponse.json(
      { repo: repoData, truncated, fileCount: Object.keys(fileMap).length },
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

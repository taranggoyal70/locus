import { NextResponse } from "next/server";

import { track } from "@/lib/analytics";
import { authenticateApiKey } from "@/lib/api-auth";
import { buildGraph, locate } from "@/lib/localizer";
import { fileContent, type RepoData } from "@/lib/types";

const API_RATE_LIMIT = 30;
const API_RATE_WINDOW_MS = 60_000;
type RateEntry = { count: number; resetAt: number };
const apiRateLimits = new Map<string, RateEntry>();

function checkApiRateLimit(userId: string): { allowed: boolean; remaining: number; retryAfter: number } {
  const now = Date.now();
  const current = apiRateLimits.get(userId);
  const entry = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + API_RATE_WINDOW_MS }
    : current;
  entry.count += 1;
  apiRateLimits.set(userId, entry);
  if (apiRateLimits.size > 10_000) {
    for (const [k, v] of apiRateLimits) if (v.resetAt <= now) apiRateLimits.delete(k);
  }
  return {
    allowed: entry.count <= API_RATE_LIMIT,
    remaining: Math.max(0, API_RATE_LIMIT - entry.count),
    retryAfter: Math.max(1, Math.ceil((entry.resetAt - now) / 1_000)),
  };
}

const MAX_FILES = 200;
const MAX_FILE_BYTES = 100_000;
const MAX_TOTAL_BYTES = 5_000_000;
const MAX_BODY_BYTES = 50_000;
const FETCH_TIMEOUT_MS = 8_000;
const DOWNLOAD_CONCURRENCY = 8;
const SRC_RE = /\.(tsx?|jsx?)$/;
const IGNORE = /(^|\/)(node_modules|\.next|dist|build|\.git|vendor|tests?|__tests__|e2e)\//i;

function ghHeaders(token?: string) {
  const h: Record<string, string> = { Accept: "application/vnd.github+json" };
  const t = token || process.env.GITHUB_TOKEN;
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
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
  if (short) return { owner: short[1], repo: short[2].replace(/\.git$/, ""), ref: short[3] };
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    if (url.hostname !== "github.com" && url.hostname !== "www.github.com") return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1].replace(/\.git$/, ""), ref: parts[2] === "tree" && parts.length > 3 ? parts.slice(3).join("/") : undefined };
  } catch { return null; }
}

function commonRoot(paths: string[]): string {
  const split = paths.map((p) => p.split("/").slice(0, -1)).filter((s) => s.length > 0);
  if (!split.length) return "";
  let prefix = split[0];
  for (const parts of split) {
    let i = 0;
    while (i < prefix.length && i < parts.length && prefix[i] === parts[i]) i++;
    prefix = prefix.slice(0, i);
  }
  const sourceIndex = prefix.lastIndexOf("src");
  if (sourceIndex >= 0) return prefix.slice(0, sourceIndex + 1).join("/");
  const surfaceIndex = prefix.findIndex((part) => part === "app" || part === "pages");
  if (surfaceIndex >= 0) return prefix.slice(0, surfaceIndex).join("/");
  return prefix.join("/");
}

function rawPath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

type FetchedRepo = {
  repo: RepoData;
  source: {
    candidateFiles: number;
    selectedFiles: number;
    loadedFiles: number;
    truncated: boolean;
  };
};

async function fetchRepo(repoUrl: string, githubToken?: string): Promise<FetchedRepo> {
  const parsed = parseRepo(repoUrl);
  if (!parsed) throw new Error("Invalid repository. Use owner/repo or a GitHub URL.");
  const { owner, repo, ref } = parsed;
  const headers = ghHeaders(githubToken);

  const info = await fetchWithTimeout(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  if (info.status === 404) throw new Error("Repository not found or is private.");
  if (!info.ok) throw new Error(`GitHub error (${info.status}).`);
  const meta = await info.json();
  const revision = ref || meta.default_branch || "main";

  const treeRes = await fetchWithTimeout(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(revision)}?recursive=1`,
    { headers },
  );
  if (!treeRes.ok) throw new Error("Could not read the repository file tree.");
  const tree = await treeRes.json();
  if (!Array.isArray(tree.tree)) throw new Error("Invalid repository tree.");
  const resolvedRevision = String(tree.sha || revision);

  const sourceCandidates = (tree.tree as { path: string; type: string; size?: number }[])
    .filter((n) => n.type === "blob" && SRC_RE.test(n.path) && !IGNORE.test(n.path));
  const candidates = sourceCandidates.filter((n) => (n.size ?? 0) <= MAX_FILE_BYTES);
  const files: string[] = [];
  let sourceBytes = 0;
  for (const file of candidates) {
    const size = file.size ?? MAX_FILE_BYTES;
    if (files.length >= MAX_FILES || sourceBytes + size > MAX_TOTAL_BYTES) break;
    files.push(file.path);
    sourceBytes += size;
  }
  if (files.length === 0) throw new Error("No JavaScript or TypeScript source found.");

  const entries = await mapConcurrent(files, DOWNLOAD_CONCURRENCY, async (path) => {
    try {
      const r = await fetchWithTimeout(`https://raw.githubusercontent.com/${owner}/${repo}/${resolvedRevision}/${rawPath(path)}`);
      if (!r.ok) return null;
      const bytes = await r.arrayBuffer();
      if (bytes.byteLength > MAX_FILE_BYTES) return null;
      return [path, new TextDecoder().decode(bytes)] as const;
    } catch { return null; }
  });

  const fileMap: Record<string, string> = {};
  for (const e of entries) { if (e) fileMap[e[0]] = e[1]; }
  if (Object.keys(fileMap).length === 0) throw new Error("Source files could not be downloaded.");

  const loadedFiles = Object.keys(fileMap).length;
  let recentlyChanged: string[] = [];
  try {
    const commits = await fetchWithTimeout(
      `https://api.github.com/repos/${owner}/${repo}/commits?per_page=5&sha=${encodeURIComponent(resolvedRevision)}`,
      { headers },
    ).then((response) => (response.ok ? response.json() : []));
    const details = await mapConcurrent(
      (commits as { sha: string }[]).slice(0, 5),
      5,
      (commit) => fetchWithTimeout(
        `https://api.github.com/repos/${owner}/${repo}/commits/${commit.sha}`,
        { headers },
      ).then((response) => (response.ok ? response.json() : null)).catch(() => null),
    );
    const changed = new Set<string>();
    const bulkThreshold = Math.max(2, Math.floor(0.4 * loadedFiles));
    for (const detail of details) {
      const changedFiles = (detail?.files ?? []) as { filename: string }[];
      if (changedFiles.length === 0 || changedFiles.length > bulkThreshold) continue;
      for (const changedFile of changedFiles) {
        if (fileMap[changedFile.filename] !== undefined) changed.add(changedFile.filename);
      }
    }
    recentlyChanged = [...changed];
  } catch {
    recentlyChanged = [];
  }

  return {
    repo: {
      name: `${owner}/${repo}`,
      slug: `${owner}-${repo}`,
      description: meta.description || `${owner}/${repo}`,
      root: commonRoot(Object.keys(fileMap)),
      recentlyChanged,
      files: fileMap,
    },
    source: {
      candidateFiles: sourceCandidates.length,
      selectedFiles: files.length,
      loadedFiles,
      truncated:
        tree.truncated === true
        || candidates.length < sourceCandidates.length
        || files.length < candidates.length
        || loadedFiles < files.length,
    },
  };
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function cors(response: NextResponse): NextResponse {
  for (const [k, v] of Object.entries(CORS_HEADERS)) response.headers.set(k, v);
  return response;
}

export async function POST(request: Request) {
  const apiKey = await authenticateApiKey(request);
  if (!apiKey) {
    return cors(NextResponse.json(
      { error: "Invalid or missing API key. Use Authorization: Bearer lk_..." },
      { status: 401 },
    ));
  }

  const rate = checkApiRateLimit(apiKey.userId);
  if (!rate.allowed) {
    return cors(NextResponse.json(
      { error: "Rate limit exceeded. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter), "X-RateLimit-Remaining": "0" } },
    ));
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return cors(NextResponse.json({ error: "Request body too large." }, { status: 413 }));
  }

  let body: { repo: string; task: string; evidence?: string; budget?: number };
  const rawBody = await readLimitedBody(request);
  if (rawBody.tooLarge) {
    return cors(NextResponse.json({ error: "Request body too large." }, { status: 413 }));
  }
  try {
    body = JSON.parse(rawBody.text ?? "");
  } catch {
    return cors(NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }));
  }

  if (!body.repo || typeof body.repo !== "string" || body.repo.length > 300) {
    return cors(NextResponse.json({ error: "repo (string, max 300 chars) is required." }, { status: 400 }));
  }
  if (!body.task || typeof body.task !== "string" || body.task.length > 1000) {
    return cors(NextResponse.json({ error: "task (string, max 1000 chars) is required." }, { status: 400 }));
  }
  if (body.evidence && (typeof body.evidence !== "string" || body.evidence.length > 50_000)) {
    return cors(NextResponse.json({ error: "evidence must be a string under 50,000 characters." }, { status: 400 }));
  }
  if (
    body.budget !== undefined
    && (!Number.isInteger(body.budget) || body.budget < 1 || body.budget > 100_000)
  ) {
    return cors(NextResponse.json(
      { error: "budget must be an integer between 1 and 100,000." },
      { status: 400 },
    ));
  }

  try {
    const { repo, source } = await fetchRepo(body.repo);
    const graph = buildGraph(repo);
    const result = locate(body.task, repo, graph, body.evidence ?? "");

    const budget = body.budget ?? 40_000;
    const packed: string[] = [];
    let tokens = 0;
    let omittedFiles = 0;
    for (const f of result.slice) {
      const content = fileContent(repo, f.rel);
      if (content === undefined) continue;
      const t = Math.ceil(content.length / 4);
      if (tokens + t > budget) {
        omittedFiles += 1;
        continue;
      }
      packed.push(`===== ${f.rel} =====\n${content}`);
      tokens += t;
    }

    track({
      event: "api_locate",
      userId: apiKey.userId,
      properties: {
        repo: body.repo,
        sliceFiles: result.slice.length,
        savedPct: result.savedPct,
        widened: result.widened,
        sourceTruncated: source.truncated,
      },
    });

    return cors(NextResponse.json({
      task: result.task,
      widened: result.widened,
      reason: result.reason,
      refinement: result.refinement,
      anchors: result.anchors,
      slice: result.slice.map((f) => ({
        path: f.rel,
        tokens: f.tokens,
        distance: f.dist,
        recent: f.recent,
      })),
      excluded: result.excluded,
      tokens: { slice: result.sliceTokens, total: result.totalTokens, savedPct: result.savedPct },
      context: packed.join("\n\n"),
      contextMeta: {
        includedFiles: packed.length,
        omittedFiles,
        tokens,
        budget,
      },
      source,
    }));
  } catch (error) {
    return cors(NextResponse.json(
      { error: error instanceof Error ? error.message : "Analysis failed." },
      { status: 422 },
    ));
  }
}

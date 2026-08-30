import { NextResponse } from "next/server";
import { contentShape } from "@/lib/agent/data-policy";

import { track } from "@/lib/analytics";
import { authenticateApiKey } from "@/lib/api-auth";
import { buildGraph, locate } from "@/lib/localizer";
import { consumeRateLimit } from "@/lib/rate-limit";
import { readLimitedJson } from "@/lib/request-security";
import { fileContent, type LocateResult, type RepoData } from "@/lib/types";

const API_RATE_LIMIT = 30;

const MAX_FILES = 200;
const MAX_FILE_BYTES = 100_000;
const MAX_TOTAL_BYTES = 5_000_000;
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
  return prefix.join("/");
}

function rawPath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

/**
 * A repository this route must not read. Distinct from the generic failure so the
 * handler can answer 403 rather than 422: the caller authenticated correctly and
 * the request is well-formed, they simply are not permitted this repository.
 */
export class RepositoryNotPublicError extends Error {}

async function fetchRepo(repoUrl: string, githubToken?: string): Promise<RepoData> {
  const parsed = parseRepo(repoUrl);
  if (!parsed) throw new Error("Invalid repository. Use owner/repo or a GitHub URL.");
  const { owner, repo, ref } = parsed;
  const headers = ghHeaders(githubToken);

  const info = await fetchWithTimeout(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  if (info.status === 404) throw new Error("Repository not found or is private.");
  if (!info.ok) throw new Error(`GitHub error (${info.status}).`);
  const meta = await info.json();
  // A 404 only hides a private repository while the server token cannot see it.
  // Reachability is a property of that token's scope, not of anything the caller
  // proved, so refuse on the metadata instead: the same check `/api/github` makes.
  // Without it, widening the token to `repo` scope silently turns this route into
  // a cross-tenant source-disclosure path.
  if (meta?.private === true || (typeof meta?.visibility === "string" && meta.visibility !== "public")) {
    throw new RepositoryNotPublicError("This API supports public repositories only.");
  }
  const revision = ref || meta.default_branch || "main";

  const treeRes = await fetchWithTimeout(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(revision)}?recursive=1`,
    { headers },
  );
  if (!treeRes.ok) throw new Error("Could not read the repository file tree.");
  const tree = await treeRes.json();
  if (!Array.isArray(tree.tree)) throw new Error("Invalid repository tree.");
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

  return {
    name: `${owner}/${repo}`,
    slug: `${owner}-${repo}`,
    description: meta.description || `${owner}/${repo}`,
    root: commonRoot(Object.keys(fileMap)),
    recentlyChanged: [],
    files: fileMap,
  };
}

// R12: the wildcard Access-Control-Allow-Origin let any web page drive this
// authenticated API from a browser. It does not leak a key on its own, since
// the caller must already hold one, but it turns any page that has obtained a
// key into a usable client and widens the abuse surface for no benefit: this
// API is consumed by the CLI, the MCP server, and server-side callers, none of
// which are browsers and none of which consult CORS at all.
//
// Origins are therefore allowlisted, and the default is empty, so browser
// access is off unless an operator opts in.
// R12: bounds on how much context one request may pack. The default matches
// the previous behaviour; the ceiling is what was missing.
export const DEFAULT_CONTEXT_BUDGET_TOKENS = 40_000;
export const MAX_CONTEXT_BUDGET_TOKENS = 200_000;

/**
 * Clamp a caller-supplied context budget.
 *
 * The previous expression was `Number(body.budget) > 0 ? Number(body.budget) : 40_000`,
 * which has no upper bound: "budget": 1e400 parses to Infinity and packs the
 * whole repository into one response. Any valid key could do that well inside
 * the 30 per minute rate limit.
 */
export function resolveContextBudget(value: unknown): number {
  const requested = Number(value);
  if (!Number.isFinite(requested) || requested <= 0) return DEFAULT_CONTEXT_BUDGET_TOKENS;
  return Math.min(requested, MAX_CONTEXT_BUDGET_TOKENS);
}

function sparseGraphWarning(result: LocateResult): string | null {
  if (!result.sparse || result.widened) return null;
  return (
    `warning: few internal imports resolved (${result.edgeDensity.toFixed(2)} edges/file), ` +
    `so this Slice may be missing real dependencies and the reduction may be overstated`
  );
}

const CORS_BASE_HEADERS = {
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
  // The response varies by request Origin, so caches must not share it.
  Vary: "Origin",
};

function allowedOrigins(): string[] {
  return (process.env.LOCUS_API_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  if (origin && allowedOrigins().includes(origin)) {
    return { ...CORS_BASE_HEADERS, "Access-Control-Allow-Origin": origin };
  }
  // Omitting the header makes a browser block the response. Non-browser
  // clients never consult it, so CLI and server callers are unaffected.
  return CORS_BASE_HEADERS;
}

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

function cors(response: NextResponse, request: Request): NextResponse {
  for (const [k, v] of Object.entries(corsHeaders(request))) response.headers.set(k, v);
  return response;
}

export async function POST(request: Request) {
  const apiKey = await authenticateApiKey(request);
  if (!apiKey) {
    return cors(NextResponse.json(
      { error: "Invalid or missing API key. Use Authorization: Bearer lk_..." },
      { status: 401 },
    ), request);
  }

  let rate;
  try {
    rate = await consumeRateLimit({
      namespace: "api-locate",
      identity: apiKey.userId,
      limit: API_RATE_LIMIT,
      windowSeconds: 60,
    });
  } catch {
    return cors(NextResponse.json(
      { error: "Rate limit could not be verified. Try again shortly." },
      { status: 503 },
    ), request);
  }
  if (!rate.allowed) {
    return cors(NextResponse.json(
      { error: "Rate limit exceeded. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds), "X-RateLimit-Remaining": "0" } },
    ), request);
  }

  const parsed = await readLimitedJson<{
    repo: string;
    task: string;
    evidence?: string;
    budget?: number;
  }>(request, 50_000);
  if (!parsed.ok) return cors(NextResponse.json({ error: parsed.error }, { status: parsed.status }), request);
  const body = parsed.value;
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return cors(NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 }), request);
  }

  if (!body.repo || typeof body.repo !== "string" || body.repo.length > 300) {
    return cors(NextResponse.json({ error: "repo (string, max 300 chars) is required." }, { status: 400 }), request);
  }
  if (!body.task || typeof body.task !== "string" || body.task.length > 1000) {
    return cors(NextResponse.json({ error: "task (string, max 1000 chars) is required." }, { status: 400 }), request);
  }
  if (body.evidence && (typeof body.evidence !== "string" || body.evidence.length > 50_000)) {
    return cors(NextResponse.json({ error: "evidence must be a string under 50,000 characters." }, { status: 400 }), request);
  }

  try {
    const repo = await fetchRepo(body.repo);
    const graph = buildGraph(repo);
    const result = locate(body.task, repo, graph, body.evidence ?? "");

    const budget = resolveContextBudget(body.budget);
    const taskShape = contentShape(body.task);
    const packed: string[] = [];
    const warning = sparseGraphWarning(result);
    if (warning) packed.push(`# ${warning}`);
    let packedFiles = 0;
    let tokens = 0;
    for (const f of result.slice) {
      const content = fileContent(repo, f.rel);
      if (!content) continue;
      const t = Math.ceil(content.length / 4);
      if (packedFiles > 0 && tokens + t > budget) continue;
      packed.push(`===== ${f.path} =====\n${content}`);
      packedFiles += 1;
      tokens += t;
    }

    track({
      event: "api_locate",
      userId: apiKey.userId,
      properties: {
        // R13: the task is what a user typed about their own codebase. The
        // shape is enough to count and correlate requests; the words are not
        // needed here and are retained on a different schedule than the Run
        // record the user can see and delete.
        taskShape: taskShape.digest,
        taskCharacters: taskShape.characters,
        sliceFiles: result.slice.length,
        widened: result.widened,
        includedTokens: result.sliceTokens,
        totalTokens: result.totalTokens,
      },
    });

    return cors(NextResponse.json({
      task: result.task,
      widened: result.widened,
      reason: result.reason,
      // Every path this response names is repo-relative, so a caller can open it
      // in a checkout of `repo` without knowing the source root. For a repo with
      // no source root the two spellings are identical; for one rooted at `src`
      // the old source-root-relative spelling did not resolve at all.
      refinement: result.refinement && {
        unmatchedTerms: result.refinement.unmatchedTerms,
        candidateFiles: result.refinement.candidateFilePaths,
        repositoryTerms: result.refinement.repositoryTerms,
      },
      anchors: result.anchorPaths,
      // A caller acting on `slice` and `tokens` has no other way to tell that a
      // small Slice came from unresolved imports rather than from good
      // localization, and in that case the reported saving is overstated. The web
      // UI has surfaced this since launch; the API had no equivalent.
      graph: { edgeDensity: Number(result.edgeDensity.toFixed(3)), sparse: result.sparse },
      slice: result.slice.map((f) => ({
        path: f.path,
        tokens: f.tokens,
        distance: f.dist,
        recent: f.recent,
      })),
      excluded: result.excludedPaths,
      tokens: { included: result.sliceTokens, total: result.totalTokens },
      context: packed.join("\n\n"),
    }), request);
  } catch (error) {
    if (error instanceof RepositoryNotPublicError) {
      return cors(NextResponse.json({ error: error.message }, { status: 403 }), request);
    }
    return cors(NextResponse.json(
      { error: error instanceof Error ? error.message : "Analysis failed." },
      { status: 422 },
    ), request);
  }
}

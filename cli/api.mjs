// Locus API client — the seam where localization stopped being local.
//
// buildGraph and locate run on the server. This module uploads the working tree
// and adapts the JSON response back into the result shape the CLI and MCP server
// already consume, so every caller downstream of `locate()` is unchanged.
//
// Two consequences worth stating plainly, because they are new:
//   - source leaves the machine. Whatever this sends is processed server-side.
//   - a run needs a network and an API key. There is no offline mode.

export const DEFAULT_API_URL = "https://locus-five-iota.vercel.app";

// Mirrors the server's limits in src/lib/uploaded-repo.ts. Enforced here too so
// an oversized tree fails locally with a useful message instead of costing a
// round trip to be told the same thing.
export const MAX_FILES = 200;
export const MAX_FILE_BYTES = 100_000;
export const MAX_TOTAL_BYTES = 5_000_000;

const REQUEST_TIMEOUT_MS = 60_000;

/** Only source the server will accept; manifests are loaded locally but not sent. */
const SOURCE_EXT_RE = /\.(tsx?|jsx?|mts|cts|mjs|cjs|py|vue|svelte|astro)$/;

export class LocusApiError extends Error {}

function apiUrl(explicit) {
  const base = explicit || process.env.LOCUS_API_URL || DEFAULT_API_URL;
  return base.replace(/\/+$/, "");
}

function apiKey(explicit) {
  const key = explicit || process.env.LOCUS_API_KEY;
  if (!key) {
    throw new LocusApiError(
      "No API key. Set LOCUS_API_KEY, or pass --api-key.\n"
      + "Locus runs localization on the server, so a key is required. Get one at "
      + `${apiUrl()}/pricing`,
    );
  }
  return key;
}

function byteLength(value) {
  return Buffer.byteLength(value, "utf8");
}

/**
 * Reduce a loaded repo to the map the server accepts.
 *
 * Manifest files (package.json, tsconfig.json) are dropped: the server rejects
 * anything SOURCE_EXT_RE does not match, and they were only ever read locally to
 * resolve workspace aliases — which is now the server's job, from the source it
 * receives.
 */
export function uploadableFiles(repo) {
  const files = {};
  let totalBytes = 0;
  let skippedLarge = 0;

  const paths = Object.keys(repo.files).filter((p) => SOURCE_EXT_RE.test(p)).sort();
  if (paths.length === 0) {
    throw new LocusApiError(
      "No supported source to send. Locus reads JavaScript, TypeScript, and Python.",
    );
  }

  let count = 0;
  for (const rel of paths) {
    const contents = repo.files[rel];
    if (typeof contents !== "string") continue;
    const size = byteLength(contents);
    // Skipping an oversized file rather than failing matches how the GitHub path
    // treats one: a single vendored bundle should not make the repo unanalyzable.
    if (size > MAX_FILE_BYTES) { skippedLarge += 1; continue; }
    if (count >= MAX_FILES) break;
    if (totalBytes + size > MAX_TOTAL_BYTES) break;
    files[rel] = contents;
    totalBytes += size;
    count += 1;
  }

  if (count === 0) {
    throw new LocusApiError(
      `Every candidate file is over the ${MAX_FILE_BYTES} byte limit, so there is nothing to analyze.`,
    );
  }

  return {
    files,
    totalBytes,
    sentFiles: count,
    truncated: count < paths.length - skippedLarge,
    skippedLarge,
  };
}

/**
 * Map the API response onto the shape `locate()` used to return.
 *
 * The server speaks repo-relative paths; the rest of the CLI expects both a full
 * `path` and a root-relative `rel`, because `fileContent` looks the file up by
 * `rel` under `repo.root`. Deriving one from the other here keeps every
 * downstream caller — the formatters, the Guard manifest — untouched.
 */
export function adaptResponse(body, repo) {
  const root = repo.root ? `${repo.root}/` : "";
  const slice = (body.slice ?? []).map((file) => ({
    path: file.path,
    rel: root && file.path.startsWith(root) ? file.path.slice(root.length) : file.path,
    tokens: file.tokens,
    dist: file.distance,
    recent: file.recent,
  }));

  const sliceTokens = body.tokens?.included ?? 0;
  const totalTokens = body.tokens?.total ?? 0;
  const excluded = body.excluded ?? [];

  return {
    task: body.task,
    widened: Boolean(body.widened),
    reason: body.reason,
    refinement: body.refinement && {
      unmatchedTerms: body.refinement.unmatchedTerms ?? [],
      candidateFilePaths: body.refinement.candidateFiles ?? [],
      repositoryTerms: body.refinement.repositoryTerms ?? [],
    },
    // The local result carried each of these under two spellings and the
    // formatters read whichever they were written against. Both are supplied so
    // no output surface has to know that localization moved off the machine.
    anchors: body.anchors ?? [],
    anchorPaths: body.anchors ?? [],
    slice,
    excluded,
    excludedPaths: excluded,
    sliceTokens,
    totalTokens,
    // Derived rather than returned: the API reports the two token counts and the
    // saving is the whole headline the CLI prints from them.
    savedPct: totalTokens > 0 ? Math.round((1 - sliceTokens / totalTokens) * 100) : 0,
    edgeDensity: body.graph?.edgeDensity ?? 0,
    sparse: Boolean(body.graph?.sparse),
    coverage: body.coverage,
    // The server already packed a context blob under the requested budget. The
    // local packer remains available for callers that want a different budget
    // without a second round trip.
    context: body.context,
  };
}

/**
 * Localize a task against a locally loaded repo, server-side.
 *
 * Returns the same result shape the old local `locate()` produced.
 */
export async function locateRemote(task, repo, {
  evidence = "",
  budget,
  url,
  key,
  fetchImpl = globalThis.fetch,
} = {}) {
  const endpoint = `${apiUrl(url)}/api/v1/locate`;
  const token = apiKey(key);
  const upload = uploadableFiles(repo);

  const payload = {
    task,
    files: upload.files,
    name: repo.name || "workspace",
  };
  if (evidence) payload.evidence = evidence;
  if (budget) payload.budget = budget;

  // An explicit controller rather than AbortSignal.timeout(): that helper's timer
  // is not unref'd, so it holds the event loop open for the full timeout after
  // the response has already arrived and the CLI sits there having printed its
  // answer, apparently hung.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  if (typeof timer.unref === "function") timer.unref();

  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (cause) {
    throw new LocusApiError(
      `Could not reach the Locus API at ${endpoint}: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json();
      detail = body?.error ? `: ${body.error}` : "";
    } catch {
      // A non-JSON body carries nothing worth surfacing over the status code.
    }
    if (response.status === 401) {
      throw new LocusApiError(`API key rejected${detail || "."}`);
    }
    if (response.status === 429) {
      const retry = response.headers.get("retry-after");
      throw new LocusApiError(
        `Rate limited${retry ? `; retry in ${retry}s` : ""}${detail}`,
      );
    }
    throw new LocusApiError(`Locus API error ${response.status}${detail}`);
  }

  const body = await response.json();
  const result = adaptResponse(body, repo);
  result.upload = {
    sentFiles: upload.sentFiles,
    totalBytes: upload.totalBytes,
    truncated: upload.truncated,
    skippedLarge: upload.skippedLarge,
  };
  return result;
}

import type { RepoData } from "@/lib/types";

/**
 * Builds a RepoData from a file map the caller uploaded, rather than one the
 * server fetched from GitHub.
 *
 * This exists so the published client can stay thin: it walks the developer's
 * working tree, ships the source here, and the Graph and Slice are computed
 * server-side. The localizer never leaves the server, and an uncommitted working
 * tree is still analyzable — which the GitHub path cannot do, because there is
 * nothing to fetch for a change that has not been pushed.
 *
 * Every limit here mirrors the GitHub path in `/api/v1/locate`. They are not
 * advisory: an uploaded map is attacker-controlled in a way a GitHub tree is
 * not, so each one is enforced before a single byte reaches the localizer.
 */

export const UPLOAD_MAX_FILES = 200;
export const UPLOAD_MAX_FILE_BYTES = 100_000;
export const UPLOAD_MAX_TOTAL_BYTES = 5_000_000;
export const UPLOAD_MAX_PATH_LENGTH = 400;

/** Mirrors SOURCE_EXT_RE in the localizer. */
const SOURCE_EXT_RE = /\.(tsx?|jsx?|mts|cts|mjs|cjs|py|vue|svelte|astro)$/;

/** Rejected as a path, not merely ignored: these cannot name a source file. */
const UNSAFE_SEGMENT = new Set(["", ".", ".."]);

export class UploadRejectedError extends Error {}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

/**
 * A path is safe when it is relative, forward-slashed, and contains no traversal
 * or device segment. The uploaded map is only ever read as a lookup key, never
 * used to touch a filesystem, so this is defence in depth rather than the only
 * thing standing between a caller and the disk — but a `../` key would still
 * corrupt the root prefix that `fileContent` depends on.
 */
function assertSafePath(path: string): void {
  if (typeof path !== "string" || !path) {
    throw new UploadRejectedError("Every file key must be a non-empty string.");
  }
  if (path.length > UPLOAD_MAX_PATH_LENGTH) {
    throw new UploadRejectedError(`File paths must be under ${UPLOAD_MAX_PATH_LENGTH} characters.`);
  }
  if (path.includes("\\")) {
    throw new UploadRejectedError(`Use forward slashes in file paths: ${path}`);
  }
  if (path.includes("\0")) {
    throw new UploadRejectedError("File paths must not contain null bytes.");
  }
  if (path.startsWith("/")) {
    throw new UploadRejectedError(`File paths must be relative: ${path}`);
  }
  for (const segment of path.split("/")) {
    if (UNSAFE_SEGMENT.has(segment)) {
      throw new UploadRejectedError(`File paths must not contain "${segment}" segments: ${path}`);
    }
  }
}

/**
 * The longest directory prefix shared by every path, which the localizer treats
 * as the source root. Identical to the GitHub path's derivation so an uploaded
 * repository and a fetched one produce the same Slice for the same source.
 */
export function commonRoot(paths: string[]): string {
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

export type UploadedRepo = {
  repo: RepoData;
  analyzedFiles: number;
  sourceBytes: number;
};

/**
 * Validate and normalise an uploaded file map.
 *
 * Throws UploadRejectedError with a caller-facing message on every rejection, so
 * the route can answer 400 with a reason the CLI can print verbatim instead of a
 * generic failure the developer cannot act on.
 */
export function repoFromUpload(files: unknown, name = "workspace"): UploadedRepo {
  if (typeof files !== "object" || files === null || Array.isArray(files)) {
    throw new UploadRejectedError("files must be a JSON object of path to contents.");
  }

  const entries = Object.entries(files as Record<string, unknown>);
  if (entries.length === 0) {
    throw new UploadRejectedError("files must contain at least one source file.");
  }
  if (entries.length > UPLOAD_MAX_FILES) {
    throw new UploadRejectedError(
      `Too many files: ${entries.length}. Send at most ${UPLOAD_MAX_FILES}.`,
    );
  }

  const fileMap: Record<string, string> = {};
  let sourceBytes = 0;

  for (const [path, contents] of entries) {
    assertSafePath(path);
    if (!SOURCE_EXT_RE.test(path)) {
      throw new UploadRejectedError(
        `Unsupported file type: ${path}. Locus reads JavaScript, TypeScript, and Python.`,
      );
    }
    if (typeof contents !== "string") {
      throw new UploadRejectedError(`File contents must be a string: ${path}`);
    }
    const size = byteLength(contents);
    if (size > UPLOAD_MAX_FILE_BYTES) {
      throw new UploadRejectedError(
        `${path} is ${size} bytes, over the ${UPLOAD_MAX_FILE_BYTES} byte per-file limit.`,
      );
    }
    sourceBytes += size;
    if (sourceBytes > UPLOAD_MAX_TOTAL_BYTES) {
      throw new UploadRejectedError(
        `Upload exceeds the ${UPLOAD_MAX_TOTAL_BYTES} byte total limit.`,
      );
    }
    fileMap[path] = contents;
  }

  const paths = Object.keys(fileMap);
  return {
    repo: {
      name,
      slug: name.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "workspace",
      description: name,
      root: commonRoot(paths),
      recentlyChanged: [],
      files: fileMap,
    },
    analyzedFiles: paths.length,
    sourceBytes,
  };
}

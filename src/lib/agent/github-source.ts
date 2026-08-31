import { normalizePublicGitHubRepository } from "@/lib/agent/vercel-workspace";
import type { RepoData } from "@/lib/types";

// The byte budget is the primary memory bound. Keep enough file slots for
// documentation-heavy application Repos whose many small files remain well
// below that bound (the production Locus canary has 246 files at ~1.1 MB).
const MAX_FILES = 500;
const MAX_FILE_BYTES = 100_000;
const MAX_TOTAL_BYTES = 5_000_000;
const FETCH_TIMEOUT_MS = 10_000;
const DOWNLOAD_CONCURRENCY = 8;
const SOURCE_FILE = /\.(tsx?|jsx?|json|css|scss|md)$/i;
const IGNORE_DIRECTORY =
  /(^|\/)(node_modules|\.next|dist|build|coverage|\.git|vendor|fixtures?|snapshots?)\//i;

export type PublicGitHubCoordinates = {
  owner: string;
  repo: string;
  cloneUrl: string;
};

export function publicGitHubCoordinates(input: string): PublicGitHubCoordinates {
  const cloneUrl = normalizePublicGitHubRepository(input);
  const [owner, repository] = new URL(cloneUrl).pathname
    .replace(/^\/|\.git$/g, "")
    .split("/");
  return { owner, repo: repository, cloneUrl };
}

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env["GITHUB_TOKEN"];
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
}

async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  work: (item: T) => Promise<R>,
): Promise<R[]> {
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

function commonRoot(paths: string[]): string {
  const directories = paths
    .map((path) => path.split("/").slice(0, -1))
    .filter((segments) => segments.length > 0);
  if (directories.length === 0) return "";

  let prefix = directories[0];
  for (const directory of directories) {
    let index = 0;
    while (index < prefix.length && prefix[index] === directory[index]) index++;
    prefix = prefix.slice(0, index);
  }
  return prefix.join("/");
}

function rawPath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

export type FetchedAgentRepository = {
  repo: RepoData;
  cloneUrl: string;
  resolvedRevision: string;
  truncated: boolean;
};

/**
 * R11: repository ingestion was capped, so the view the Agent reasons over is
 * not the repository.
 *
 * The consequences are not merely "less context". The excluded ledger is built
 * from what was fetched, so a file that never arrived is not excluded, it is
 * invisible: the Agent cannot widen into it and will not know to. Sensitive
 * path classification and the trusted base used to reconstruct the review diff
 * are both derived from the same partial view. A run that silently proceeds is
 * reasoning about a repository that does not exist.
 *
 * Carries its own user-facing message because the generic workflow_error text
 * would not tell an operator what to do about it.
 */
export class IncompleteRepositoryError extends Error {
  constructor(name: string) {
    super(
      `Locus could not ingest all of ${name} within its safety caps, so the Run was stopped before it started. `
        + "Reasoning over a partial repository would produce a Slice, an excluded ledger, and a review diff "
        + "derived from a tree that is not the real one. Narrow the repository or raise the ingestion caps.",
    );
    this.name = "IncompleteRepositoryError";
  }
}

/**
 * R11: the admission gate for a fetched repository. Call before granting any
 * Agent capability. Separate from the workflow so the decision is testable
 * without standing up a Run.
 */
export function assertCompleteRepository(fetched: FetchedAgentRepository): void {
  if (fetched.truncated) {
    throw new IncompleteRepositoryError(fetched.repo.name);
  }
}

export async function fetchAgentRepository(
  repository: string,
  requestedRevision?: string,
): Promise<FetchedAgentRepository> {
  const { owner, repo, cloneUrl } = publicGitHubCoordinates(repository);
  const headers = githubHeaders();
  const info = await fetchWithTimeout(`https://api.github.com/repos/${owner}/${repo}`, {
    headers,
  });
  if (info.status === 404) throw new Error("Public GitHub repository was not found");
  if (!info.ok) throw new Error(`GitHub repository lookup failed (${info.status})`);

  const metadata = await info.json() as { default_branch?: string; description?: string };
  const revision = requestedRevision?.trim() || metadata.default_branch || "main";
  const commitResponse = await fetchWithTimeout(
    `https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(revision)}`,
    { headers },
  );
  if (!commitResponse.ok) {
    throw new Error(`GitHub revision ${revision} could not be resolved (${commitResponse.status})`);
  }
  const commit = await commitResponse.json() as {
    sha?: string;
    commit?: { tree?: { sha?: string } };
  };
  if (!commit.sha || !commit.commit?.tree?.sha) {
    throw new Error("GitHub returned an invalid commit");
  }
  const treeResponse = await fetchWithTimeout(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${commit.commit.tree.sha}?recursive=1`,
    { headers },
  );
  if (!treeResponse.ok) {
    throw new Error(`GitHub revision ${revision} could not be read (${treeResponse.status})`);
  }

  const tree = await treeResponse.json() as {
    sha?: string;
    truncated?: boolean;
    tree?: Array<{ path: string; type: string; size?: number }>;
  };
  if (!Array.isArray(tree.tree)) throw new Error("GitHub returned an invalid repository tree");
  const resolvedRevision = commit.sha;
  const candidates = tree.tree.filter(
    (entry) =>
      entry.type === "blob"
      && SOURCE_FILE.test(entry.path)
      && !IGNORE_DIRECTORY.test(entry.path)
      && (entry.size ?? 0) <= MAX_FILE_BYTES,
  );

  const selected: string[] = [];
  let selectedBytes = 0;
  for (const candidate of candidates) {
    const size = candidate.size ?? MAX_FILE_BYTES;
    if (selected.length >= MAX_FILES || selectedBytes + size > MAX_TOTAL_BYTES) break;
    selected.push(candidate.path);
    selectedBytes += size;
  }
  if (selected.length === 0) throw new Error("No supported source files were found");

  const entries = await mapConcurrent(selected, DOWNLOAD_CONCURRENCY, async (path) => {
    const response = await fetchWithTimeout(
      `https://raw.githubusercontent.com/${owner}/${repo}/${resolvedRevision}/${rawPath(path)}`,
    ).catch(() => null);
    if (!response?.ok) return null;
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > MAX_FILE_BYTES) return null;
    return [path, new TextDecoder().decode(bytes)] as const;
  });

  const files: Record<string, string> = {};
  for (const entry of entries) {
    if (entry) files[entry[0]] = entry[1];
  }
  if (Object.keys(files).length === 0) {
    throw new Error("GitHub source files could not be downloaded");
  }

  return {
    repo: {
      name: `${owner}/${repo}`,
      slug: `${owner}-${repo}`,
      description: metadata.description || `${owner}/${repo}`,
      root: commonRoot(Object.keys(files)),
      recentlyChanged: [],
      files,
    },
    cloneUrl,
    resolvedRevision,
    truncated: Boolean(tree.truncated) || selected.length < candidates.length,
  };
}

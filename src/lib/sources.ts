import type { RepoData } from "@/lib/types";

// A RepoSource is where a Repo comes from. One interface, two adapters (a
// bundled demo, a GitHub fetch) — a real seam, so the app holds a RepoSource
// and calls load(), instead of branching on "bundled or GitHub?" at the caller.

export type LoadedRepo = { repo: RepoData; note?: string };

export interface RepoSource {
  readonly kind: "bundled" | "github";
  readonly label: string;
  readonly repositorySpecifier?: string;
  load(signal?: AbortSignal): Promise<LoadedRepo>;
}

const REPOSITORY_REQUEST_TIMEOUT_MS = 25_000;

function requestSignal(parent?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(REPOSITORY_REQUEST_TIMEOUT_MS);
  return parent ? AbortSignal.any([parent, timeout]) : timeout;
}

async function fetchRepository(input: RequestInfo | URL, init: RequestInit, parent?: AbortSignal) {
  try {
    return await fetch(input, { ...init, signal: requestSignal(parent) });
  } catch (error) {
    if (parent?.aborted) throw error;
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new Error("Repository request timed out. Please try again.");
    }
    throw error;
  }
}

export function parseRepoData(value: unknown): RepoData {
  if (!value || typeof value !== "object") throw new Error("Repository response was incomplete.");
  const candidate = value as Partial<RepoData>;
  const files = candidate.files;
  const validFiles = files && typeof files === "object" && !Array.isArray(files)
    && Object.keys(files).length > 0
    && Object.entries(files).every(([path, content]) => path.length > 0 && typeof content === "string");
  const validRecent = Array.isArray(candidate.recentlyChanged)
    && candidate.recentlyChanged.every((path) => typeof path === "string");
  const validStrings = [candidate.name, candidate.slug, candidate.description, candidate.root]
    .every((field) => typeof field === "string");
  if (!validFiles || !validRecent || !validStrings) throw new Error("Repository response was incomplete.");
  return candidate as RepoData;
}

export const BUNDLED = [
  {
    slug: "taxonomy",
    name: "Taxonomy",
    description:
      "shadcn-ui/taxonomy — a real Next.js App Router app (dashboard, editor, marketing, auth).",
    examples: [
      "fix the dashboard billing",
      "the blog post editor is broken",
      "update the marketing pricing page",
      "the docs sidebar navigation",
    ],
  },
  {
    slug: "studentpulse",
    name: "StudentPulse",
    description:
      "A student feedback platform with surveys, analytics dashboard, and auth.",
    examples: [
      "the survey creation form",
      "fix the analytics dashboard",
      "update the student profile page",
    ],
  },
] as const;

export function bundledSource(slug: string): RepoSource {
  return {
    kind: "bundled",
    label: BUNDLED.find((b) => b.slug === slug)?.name ?? slug,
    async load(signal) {
      const res = await fetchRepository(`/repos/${slug}.json`, {}, signal);
      if (!res.ok) throw new Error("Could not load demo repo.");
      return { repo: parseRepoData(await res.json()) };
    },
  };
}

export function githubSource(url: string): RepoSource {
  return {
    kind: "github",
    label: url,
    repositorySpecifier: url.trim(),
    async load(signal) {
      const res = await fetchRepository("/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      }, signal);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const fallback = res.status >= 500
          ? "GitHub analysis is temporarily unavailable. Please try again."
          : "Could not load repository. Check the owner/name and try again.";
        throw new Error(data?.error ?? fallback);
      }
      if (!data?.repo) throw new Error("GitHub returned an incomplete repository response. Please try again.");
      let repo: RepoData;
      try {
        repo = parseRepoData(data.repo);
      } catch {
        throw new Error("GitHub returned an incomplete repository response. Please try again.");
      }
      const truncated = data.truncated === true;
      const fileCount = Number.isInteger(data.fileCount) && data.fileCount > 0
        ? data.fileCount
        : Object.keys(repo.files).length;
      return {
        repo,
        note: `Loaded ${fileCount} source files from ${repo.name}${truncated ? " (capped for safety)" : ""}. Describe a task to localize it.`,
      };
    },
  };
}

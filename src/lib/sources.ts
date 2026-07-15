import type { RepoData } from "@/lib/types";

// A RepoSource is where a Repo comes from. One interface, two adapters (a
// bundled demo, a GitHub fetch) — a real seam, so the app holds a RepoSource
// and calls load(), instead of branching on "bundled or GitHub?" at the caller.

export type LoadedRepo = { repo: RepoData; note?: string };

export interface RepoSource {
  readonly kind: "bundled" | "github";
  readonly label: string;
  readonly repositorySpecifier?: string;
  load(): Promise<LoadedRepo>;
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
] as const;

export function bundledSource(slug: string): RepoSource {
  return {
    kind: "bundled",
    label: BUNDLED.find((b) => b.slug === slug)?.name ?? slug,
    async load() {
      const res = await fetch(`/repos/${slug}.json`);
      if (!res.ok) throw new Error("Could not load demo repo.");
      return { repo: (await res.json()) as RepoData };
    },
  };
}

export function githubSource(url: string): RepoSource {
  return {
    kind: "github",
    label: url,
    repositorySpecifier: url.trim(),
    async load() {
      const res = await fetch("/api/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const fallback = res.status >= 500
          ? "GitHub analysis is temporarily unavailable. Please try again."
          : "Could not load repository. Check the owner/name and try again.";
        throw new Error(data?.error ?? fallback);
      }
      if (!data?.repo) throw new Error("GitHub returned an incomplete repository response. Please try again.");
      const { repo, truncated, fileCount } = data as {
        repo: RepoData; truncated: boolean; fileCount: number;
      };
      return {
        repo,
        note: `Loaded ${fileCount} source files from ${repo.name}${truncated ? " (capped for safety)" : ""}. Describe a task to localize it.`,
      };
    },
  };
}

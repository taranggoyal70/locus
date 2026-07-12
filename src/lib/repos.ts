import type { RepoData } from "@/lib/types";

export const BUNDLED = [
  {
    slug: "studentpulse",
    name: "StudentPulse",
    description: "Student-success analytics SaaS — dashboard, cohorts, reports, roster.",
    examples: [
      "the dashboard chart is broken",
      "cohort retention numbers look wrong",
      "add a column to the student roster",
      "dashboard shows the wrong dates",
    ],
  },
] as const;

export async function loadBundled(slug: string): Promise<RepoData> {
  const res = await fetch(`/repos/${slug}.json`);
  if (!res.ok) throw new Error("Could not load demo repo.");
  return res.json();
}

export async function loadGithub(
  url: string,
): Promise<{ repo: RepoData; truncated: boolean; fileCount: number }> {
  const res = await fetch("/api/github", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Could not load repo.");
  return data;
}

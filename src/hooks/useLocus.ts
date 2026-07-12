"use client";

import { useEffect, useMemo, useState } from "react";

import { buildGraph, locate } from "@/lib/localizer";
import { BUNDLED, bundledSource, githubSource, type RepoSource } from "@/lib/sources";
import type { RepoData } from "@/lib/types";

// Owns everything the localizer view needs: the current Repo, the task, the
// selection, and the async loading around a RepoSource. The page renders this;
// it doesn't manage fetches or derive the graph itself. Localize (buildGraph +
// locate) is derived here — buildGraph once per Repo, locate on every task.
export function useLocus() {
  const [repo, setRepo] = useState<RepoData | null>(null);
  const [task, setTask] = useState("the dashboard chart is broken");
  const [selected, setSelected] = useState<string | null>(null);
  const [ghUrl, setGhUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function open(source: RepoSource, nextTask?: string) {
    setLoading(true); setError(null); setNote(null); setSelected(null);
    try {
      const { repo: r, note: n } = await source.load();
      setRepo(r);
      if (nextTask !== undefined) setTask(nextTask);
      if (n) setNote(n);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load repo.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void open(bundledSource("studentpulse"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const graph = useMemo(() => (repo ? buildGraph(repo) : null), [repo]);
  const result = useMemo(
    () => (repo && graph ? locate(task, repo, graph) : null),
    [repo, graph, task],
  );
  const examples = useMemo(
    () => BUNDLED.find((b) => repo && b.slug === repo.slug)?.examples ?? [],
    [repo],
  );

  return {
    repo, graph, result, task, selected, ghUrl, loading, error, note, examples,
    bundled: BUNDLED,
    setTask, setSelected, setGhUrl,
    pickBundled: (slug: string) =>
      open(bundledSource(slug), BUNDLED.find((b) => b.slug === slug)?.examples[0] ?? ""),
    loadGithub: () => ghUrl.trim() && open(githubSource(ghUrl), ""),
  };
}

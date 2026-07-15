"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { buildGraph, locate } from "@/lib/localizer";
import { sharedWorkspaceViewFrom } from "@/lib/share";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const loadVersion = useRef(0);

  async function open(source: RepoSource, nextTask?: string) {
    const version = ++loadVersion.current;
    setLoading(true); setError(null); setNote(null); setSelected(null);
    try {
      const { repo: r, note: n } = await source.load();
      if (version !== loadVersion.current) return;
      setRepo(r);
      if (nextTask !== undefined) setTask(nextTask);
      if (n) setNote(n);
    } catch (e) {
      if (version !== loadVersion.current) return;
      setError(e instanceof Error ? e.message : "Could not load repo.");
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    const version = ++loadVersion.current;
    const params = new URLSearchParams(window.location.search);
    const sharedView = sharedWorkspaceViewFrom(params);
    if (sharedView) {
      const sharedRepositorySpecifier = sharedView.repositorySpecifier.trim();
      const sharedTask = sharedView.task.trim();
      githubSource(sharedRepositorySpecifier).load().then(({ repo: sharedRepoData, note: sharedNote }) => {
        if (!active || version !== loadVersion.current) return;
        setGhUrl(sharedRepositorySpecifier);
        setRepo(sharedRepoData);
        setTask(sharedTask);
        if (sharedNote) setNote(sharedNote);
      }).catch((cause: unknown) => {
        if (active && version === loadVersion.current) setError(cause instanceof Error ? cause.message : "Could not load repo.");
      }).finally(() => {
        if (active && version === loadVersion.current) setLoading(false);
      });
      return () => { active = false; };
    }

    // Load the first bundled repo by reference — never a hardcoded slug, so a
    // rename of the demo can't leave this pointing at a deleted repo.
    bundledSource(BUNDLED[0].slug).load().then(({ repo: initialRepo, note: initialNote }) => {
      if (!active || version !== loadVersion.current) return;
      setRepo(initialRepo);
      if (initialNote) setNote(initialNote);
    }).catch((cause: unknown) => {
      if (active && version === loadVersion.current) setError(cause instanceof Error ? cause.message : "Could not load repo.");
    }).finally(() => {
      if (active && version === loadVersion.current) setLoading(false);
    });
    return () => { active = false; };
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
    loadGithub: () => ghUrl.trim() && open(githubSource(ghUrl)),
    loadGithubAt: (url: string, nextTask: string) => {
      setGhUrl(url);
      return open(githubSource(url), nextTask);
    },
  };
}

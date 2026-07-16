"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { buildGraph, locate } from "@/lib/localizer";
import { sharedWorkspaceViewFrom } from "@/lib/share";
import { BUNDLED, bundledSource, githubSource, type RepoSource } from "@/lib/sources";
import type { RepoData, TaskEvidence } from "@/lib/types";

export function useLocus() {
  const [repo, setRepo] = useState<RepoData | null>(null);
  const [task, setTask] = useState("the dashboard chart is broken");
  const [selected, setSelected] = useState<string | null>(null);
  const [ghUrl, setGhUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [loadedRepositorySpecifier, setLoadedRepositorySpecifier] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<TaskEvidence[]>([]);
  const loadVersion = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);

  async function open(source: RepoSource, nextTask?: string) {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const version = ++loadVersion.current;
    setLoading(true); setError(null); setNote(null); setSelected(null); setRepo(null);
    setLoadedRepositorySpecifier(null);
    try {
      const { repo: r, note: n } = await source.load(controller.signal);
      if (version !== loadVersion.current) return;
      setRepo(r);
      setLoadedRepositorySpecifier(source.repositorySpecifier ?? null);
      if (nextTask !== undefined) setTask(nextTask);
      if (n) setNote(n);
    } catch (e) {
      if (version !== loadVersion.current) return;
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Could not load repo.");
    } finally {
      if (version === loadVersion.current) {
        activeRequest.current = null;
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    activeRequest.current = controller;
    const version = ++loadVersion.current;
    const params = new URLSearchParams(window.location.search);
    const sharedView = sharedWorkspaceViewFrom(params);
    if (sharedView) {
      const sharedRepositorySpecifier = sharedView.repositorySpecifier.trim();
      const sharedTask = sharedView.task.trim();
      githubSource(sharedRepositorySpecifier).load(controller.signal).then(({ repo: sharedRepoData, note: sharedNote }) => {
        if (!active || version !== loadVersion.current) return;
        setGhUrl(sharedRepositorySpecifier);
        setRepo(sharedRepoData);
        setLoadedRepositorySpecifier(sharedRepositorySpecifier);
        setTask(sharedTask);
        if (sharedNote) setNote(sharedNote);
      }).catch((cause: unknown) => {
        if (active && version === loadVersion.current) setError(cause instanceof Error ? cause.message : "Could not load repo.");
      }).finally(() => {
        if (active && version === loadVersion.current) setLoading(false);
      });
      return () => { active = false; controller.abort(); };
    }

    bundledSource(BUNDLED[0].slug).load(controller.signal).then(({ repo: initialRepo, note: initialNote }) => {
      if (!active || version !== loadVersion.current) return;
      setRepo(initialRepo);
      if (initialNote) setNote(initialNote);
    }).catch((cause: unknown) => {
      if (active && version === loadVersion.current) setError(cause instanceof Error ? cause.message : "Could not load repo.");
    }).finally(() => {
      if (active && version === loadVersion.current) setLoading(false);
    });
    return () => { active = false; controller.abort(); };
  }, []);

  const graph = useMemo(() => (repo ? buildGraph(repo) : null), [repo]);
  const evidenceText = useMemo(
    () => evidence.map((item) => item.text).join("\n").slice(0, 50_000),
    [evidence],
  );
  const result = useMemo(
    () => (repo && graph ? locate(task, repo, graph, evidenceText) : null),
    [repo, graph, task, evidenceText],
  );
  const examples = useMemo(
    () => BUNDLED.find((b) => repo && b.slug === repo.slug)?.examples ?? [],
    [repo],
  );

  return {
    repo, graph, result, task, selected, ghUrl, loadedRepositorySpecifier, loading, error, note, examples, evidence,
    bundled: BUNDLED,
    setTask, setSelected, setGhUrl,
    addEvidence: (item: TaskEvidence) => setEvidence((current) => [...current, item].slice(-3)),
    removeEvidence: (id: string) => setEvidence((current) => current.filter((item) => item.id !== id)),
    pickBundled: (slug: string) =>
      open(bundledSource(slug), BUNDLED.find((b) => b.slug === slug)?.examples[0] ?? ""),
    loadGithub: () => ghUrl.trim() && open(githubSource(ghUrl)),
    loadGithubAt: (url: string, nextTask: string) => {
      setGhUrl(url);
      return open(githubSource(url), nextTask);
    },
  };
}

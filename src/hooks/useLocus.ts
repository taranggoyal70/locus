"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { buildGraph, locate } from "@/lib/localizer";
import { sharedWorkspaceViewFrom } from "@/lib/share";
import {
  BUNDLED,
  bundledSource,
  githubSource,
  type RepoSource,
  RepoSourceError,
  type RepoSourceErrorCode,
} from "@/lib/sources";
import type { RepoData, TaskEvidence } from "@/lib/types";

// Recent repositories are kept as identifiers only (e.g. "owner/repo") — never
// source content — in an in-memory, session-scoped store. Nothing is persisted
// to localStorage or disk; they reset on reload. A tiny external store keeps
// reads hydration-safe without a setState-in-effect.
const MAX_RECENTS = 6;
const EMPTY_RECENTS: string[] = [];

export type RepoLoadIssue = {
  message: string;
  code: RepoSourceErrorCode | "unknown";
  retryable: boolean;
  attemptedRepoSpecifier: string | null;
};

function repoLoadIssue(cause: unknown, source: RepoSource): RepoLoadIssue {
  const sourceError = cause instanceof RepoSourceError ? cause : null;
  return {
    message: cause instanceof Error ? cause.message : "Could not load Repo.",
    code: sourceError?.code ?? "unknown",
    retryable: Boolean(source.repositorySpecifier && sourceError?.retryable),
    attemptedRepoSpecifier: source.repositorySpecifier ?? null,
  };
}

let recentsCache: string[] = EMPTY_RECENTS;
const recentsListeners = new Set<() => void>();

function recentsSnapshot(): string[] {
  return recentsCache;
}

function subscribeRecents(callback: () => void): () => void {
  recentsListeners.add(callback);
  return () => {
    recentsListeners.delete(callback);
  };
}

function writeRecents(next: string[]): void {
  recentsCache = next;
  recentsListeners.forEach((listener) => listener());
}

export function useLocus() {
  const [repo, setRepo] = useState<RepoData | null>(null);
  const [task, setTask] = useState("the dashboard chart is broken");
  const [selected, setSelected] = useState<string | null>(null);
  const [ghUrl, setGhUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadIssue, setLoadIssue] = useState<RepoLoadIssue | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [loadedRepositorySpecifier, setLoadedRepositorySpecifier] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<TaskEvidence[]>([]);
  const recentRepos = useSyncExternalStore(subscribeRecents, recentsSnapshot, () => EMPTY_RECENTS);
  const loadVersion = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);

  function rememberRepo(specifier: string | null | undefined) {
    const spec = specifier?.trim();
    if (!spec || typeof window === "undefined") return;
    const current = recentsSnapshot();
    writeRecents(
      [spec, ...current.filter((r) => r.toLowerCase() !== spec.toLowerCase())].slice(0, MAX_RECENTS),
    );
  }

  function clearRecents() {
    if (typeof window !== "undefined") writeRecents(EMPTY_RECENTS);
  }

  async function open(source: RepoSource, nextTask?: string) {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const version = ++loadVersion.current;
    setLoading(true); setLoadIssue(null); setNote(null);
    try {
      const { repo: r, note: n } = await source.load(controller.signal);
      if (version !== loadVersion.current) return;
      setRepo(r);
      setSelected(null);
      setLoadedRepositorySpecifier(source.repositorySpecifier ?? null);
      rememberRepo(source.repositorySpecifier);
      if (nextTask !== undefined) setTask(nextTask);
      if (n) setNote(n);
    } catch (e) {
      if (version !== loadVersion.current) return;
      if (e instanceof DOMException && e.name === "AbortError") return;
      setLoadIssue(repoLoadIssue(e, source));
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
      const sharedSource = githubSource(sharedRepositorySpecifier);
      sharedSource.load(controller.signal).then(({ repo: sharedRepoData, note: sharedNote }) => {
        if (!active || version !== loadVersion.current) return;
        setGhUrl(sharedRepositorySpecifier);
        setRepo(sharedRepoData);
        setLoadedRepositorySpecifier(sharedRepositorySpecifier);
        rememberRepo(sharedRepositorySpecifier);
        setTask(sharedTask);
        if (sharedNote) setNote(sharedNote);
      }).catch((cause: unknown) => {
        if (active && version === loadVersion.current) {
          setLoadIssue(repoLoadIssue(cause, sharedSource));
        }
      }).finally(() => {
        if (active && version === loadVersion.current) setLoading(false);
      });
      return () => { active = false; controller.abort(); };
    }

    const initialSource = bundledSource(BUNDLED[0].slug);
    initialSource.load(controller.signal).then(({ repo: initialRepo, note: initialNote }) => {
      if (!active || version !== loadVersion.current) return;
      setRepo(initialRepo);
      if (initialNote) setNote(initialNote);
    }).catch((cause: unknown) => {
      if (active && version === loadVersion.current) {
        setLoadIssue(repoLoadIssue(cause, initialSource));
      }
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
    repo, graph, result, task, selected, ghUrl, loadedRepositorySpecifier, loading,
    loadIssue, note, examples, evidence,
    bundled: BUNDLED,
    recentRepos, clearRecents,
    setTask, setSelected, setGhUrl,
    addEvidence: (item: TaskEvidence) => setEvidence((current) => [...current, item].slice(-3)),
    removeEvidence: (id: string) => setEvidence((current) => current.filter((item) => item.id !== id)),
    pickBundled: (slug: string) =>
      open(bundledSource(slug), BUNDLED.find((b) => b.slug === slug)?.examples[0] ?? ""),
    loadGithub: () => ghUrl.trim() && open(githubSource(ghUrl)),
    retryRepoLoad: () => {
      const specifier = loadIssue?.attemptedRepoSpecifier;
      if (!specifier || !loadIssue.retryable) return;
      setGhUrl(specifier);
      return open(githubSource(specifier));
    },
    loadRecent: (specifier: string) => {
      setGhUrl(specifier);
      return open(githubSource(specifier));
    },
    loadGithubAt: (url: string, nextTask: string) => {
      setGhUrl(url);
      return open(githubSource(url), nextTask);
    },
  };
}

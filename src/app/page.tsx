"use client";

import { useEffect, useMemo, useState } from "react";

import { DependencyGraph } from "@/components/DependencyGraph";
import { FilePanel } from "@/components/FilePanel";
import { TokenMeter } from "@/components/TokenMeter";
import { buildGraph, locate } from "@/lib/localizer";
import { BUNDLED, loadBundled, loadGithub } from "@/lib/repos";
import type { RepoData } from "@/lib/types";

export default function Home() {
  const [repo, setRepo] = useState<RepoData | null>(null);
  const [task, setTask] = useState("the dashboard chart is broken");
  const [selected, setSelected] = useState<string | null>(null);
  const [ghUrl, setGhUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    loadBundled("studentpulse").then(setRepo).catch(() => setError("Could not load the demo repo."));
  }, []);

  const graph = useMemo(() => (repo ? buildGraph(repo) : null), [repo]);
  const result = useMemo(
    () => (repo && graph ? locate(task, repo, graph) : null),
    [repo, graph, task],
  );

  const bundledExamples =
    BUNDLED.find((b) => repo && b.slug === repo.slug)?.examples ?? [];

  async function pickBundled(slug: string) {
    setLoading(true); setError(null); setNote(null); setSelected(null);
    try {
      const r = await loadBundled(slug);
      setRepo(r);
      setTask(BUNDLED.find((b) => b.slug === slug)?.examples[0] ?? "");
    } catch {
      setError("Could not load that repo.");
    } finally {
      setLoading(false);
    }
  }

  async function analyzeGithub() {
    if (!ghUrl.trim()) return;
    setLoading(true); setError(null); setNote(null); setSelected(null);
    try {
      const { repo: r, truncated, fileCount } = await loadGithub(ghUrl);
      setRepo(r);
      setTask("");
      setNote(
        `Loaded ${fileCount} source files from ${r.name}${truncated ? " (capped at 160)" : ""}. Describe a task to localize it.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load repo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      {/* nav */}
      <header className="sticky top-0 z-20 border-b border-line bg-ink/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-2 font-semibold text-paper">
            <span className="grid size-6 place-items-center rounded bg-accent/15 font-mono text-accent">⊙</span>
            Locus
          </div>
          <a
            href="https://github.com/taranggoyal70/locus"
            className="rounded-lg border border-line-strong px-3 py-1.5 text-sm text-paper transition hover:border-accent hover:text-accent"
          >
            GitHub
          </a>
        </div>
      </header>

      {/* hero */}
      <section className="mx-auto max-w-6xl px-6 pt-14 pb-6">
        <p className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface px-3 py-1 text-xs text-muted-light">
          <span className="size-1.5 rounded-full bg-accent" /> Context localization for AI coding agents
        </p>
        <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.1] text-paper sm:text-5xl">
          Show your AI agent <span className="text-accent">only the code it needs.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-light">
          Every edit doesn&apos;t need the whole repo. Type a task and watch the irrelevant
          half of the codebase fade out — Locus maps it to the minimal dependency slice.
          Fewer input tokens, and because it <em>widens</em> when unsure, never a quality hit.
        </p>
      </section>

      {/* controls */}
      <section className="mx-auto max-w-6xl px-6">
        <div className="rounded-2xl border border-line-strong bg-surface/70 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-muted">Repo</span>
            {BUNDLED.map((b) => (
              <button
                key={b.slug}
                onClick={() => pickBundled(b.slug)}
                className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                  repo?.slug === b.slug ? "border-accent bg-accent/10 text-accent" : "border-line text-muted hover:text-paper"
                }`}
              >
                {b.name}
              </button>
            ))}
            <span className="mx-1 text-line-strong">|</span>
            <input
              value={ghUrl}
              onChange={(e) => setGhUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && analyzeGithub()}
              placeholder="or paste a public GitHub repo — owner/name"
              className="min-w-[240px] flex-1 rounded-lg border border-line-strong bg-ink px-3 py-1.5 text-sm text-paper placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <button
              onClick={analyzeGithub}
              disabled={loading || !ghUrl.trim()}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-ink transition hover:bg-accent/90 disabled:opacity-50"
            >
              {loading ? "Loading…" : "Load"}
            </button>
          </div>

          <div className="mt-4">
            <input
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="Describe a task — e.g. “the dashboard chart is broken”"
              className="w-full rounded-lg border border-line-strong bg-ink px-4 py-3 text-paper placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
            />
            {bundledExamples.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {bundledExamples.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setTask(ex)}
                    className="rounded-full border border-line px-3 py-1 text-xs text-muted transition hover:border-line-strong hover:text-paper"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            )}
          </div>
          {(error || note) && (
            <p className={`mt-3 text-xs ${error ? "text-recent" : "text-muted"}`}>{error ?? note}</p>
          )}
        </div>
      </section>

      {/* main */}
      <section className="mx-auto max-w-6xl px-6 py-6">
        {graph && result ? (
          <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
            <DependencyGraph graph={graph} result={result} selected={selected} onSelect={setSelected} />
            <div className="space-y-5">
              <TokenMeter result={result} />
              <FilePanel result={result} repo={repo} selected={selected} onSelect={setSelected} />
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-line bg-surface p-16 text-center text-sm text-muted">
            {error ?? "Loading…"}
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-muted">
          <span className="flex items-center gap-1.5"><span className="inline-block size-3 rounded bg-accent" /> in scope (sent to agent)</span>
          <span className="flex items-center gap-1.5"><span className="inline-block size-3 rounded border border-excluded bg-[rgba(58,68,74,0.25)]" /> excluded (never read)</span>
          <span className="flex items-center gap-1.5"><span className="inline-block size-2 rounded-full bg-recent" /> recently changed — likely relevant</span>
          <span className="flex items-center gap-1.5"><span className="text-accent">◎</span> anchor (the entry point)</span>
        </div>
      </section>

      {/* how it works */}
      <section className="border-t border-line bg-surface/40">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <p className="text-sm font-semibold uppercase tracking-wider text-accent">How it works</p>
          <div className="mt-6 grid gap-6 md:grid-cols-3">
            {[
              { t: "1 · Map the graph", d: "Parse imports into a deterministic dependency graph — routes → components → hooks → libs. No LLM guessing." },
              { t: "2 · Localize the task", d: "Match the task to an entry point (a route/page), then take its transitive dependency closure. That slice is all the agent needs." },
              { t: "3 · Widen, never narrow", d: "If nothing matches confidently, fall back to the whole repo. Worst case = baseline, so quality can't drop — only tokens." },
            ].map((s) => (
              <div key={s.t} className="rounded-xl border border-line bg-ink/40 p-5">
                <h3 className="font-mono text-sm font-semibold text-paper">{s.t}</h3>
                <p className="mt-2 text-sm text-muted">{s.d}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 max-w-3xl text-sm text-muted">
            Cross-cutting bugs (a shared util that broke the dashboard) are caught two ways:
            the shared file is already in the dependency slice, and a recent-change signal floats
            it to the top — so precision doesn&apos;t mean missing the real cause.
          </p>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-muted sm:flex-row">
          <span className="flex items-center gap-2">
            <span className="font-mono text-accent">⊙</span> Locus — read less, ship the same.
          </span>
          <a href="https://github.com/taranggoyal70/locus" className="hover:text-accent">Source · MIT</a>
        </div>
      </footer>
    </div>
  );
}

"use client";

import { UserButton } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { AgentRunPanel } from "@/components/AgentRunPanel";
import { ContextLens } from "@/components/ContextLens";
import { DependencyGraph } from "@/components/DependencyGraph";
import { FilePanel } from "@/components/FilePanel";
import { TaskEvidence } from "@/components/TaskEvidence";
import { TokenMeter } from "@/components/TokenMeter";
import { useLocus } from "@/hooks/useLocus";
import { REPO_URL } from "@/lib/config";
import { buildShareUrl } from "@/lib/share";

type LocusAppProps = {
  accountName?: string;
  isWorkspace?: boolean;
};

export function LocusApp({ accountName, isWorkspace = false }: LocusAppProps) {
  const {
    repo,
    graph,
    result,
    task,
    selected,
    ghUrl,
    loadedRepositorySpecifier,
    loading,
    error,
    note,
    evidence,
    examples,
    bundled,
    setTask,
    setSelected,
    setGhUrl,
    pickBundled,
    loadGithub,
    addEvidence,
    removeEvidence,
    recentRepos,
    clearRecents,
    loadRecent,
  } = useLocus();
  const [shareStatus, setShareStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [saveStatus, setSaveStatus] = useState("idle");
  const taskInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        taskInputRef.current?.focus();
      }
      if (event.key === "Escape" && selected) setSelected(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selected, setSelected]);

  function refineTask(term: string) {
    setTask((current) => `${current.trim()} ${term}`.trim());
    taskInputRef.current?.focus();
  }

  async function copyShareView() {
    if (!loadedRepositorySpecifier || !task.trim()) return;
    try {
      await navigator.clipboard.writeText(buildShareUrl(window.location.origin, {
        repositorySpecifier: loadedRepositorySpecifier,
        task,
      }));
      setShareStatus("copied");
    } catch {
      setShareStatus("failed");
    }
    window.setTimeout(() => setShareStatus("idle"), 2_200);
  }

  const saveAnalysis = useCallback(async () => {
    if (!repo || !result || !task.trim() || saveStatus === "saving") return;
    setSaveStatus("saving");
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: repo.name,
          repo_url: loadedRepositorySpecifier ?? repo.name,
          task,
          slice_files: result.slice.length,
          total_files: graph?.nodes.length ?? 0,
          saved_pct: result.savedPct,
        }),
      });
      if (response.ok) {
        setSaveStatus("saved");
      } else {
        const payload = await response.json().catch(() => null);
        setSaveStatus(payload?.error ?? "failed");
      }
    } catch {
      setSaveStatus("failed");
    }
    window.setTimeout(() => setSaveStatus("idle"), 3_500);
  }, [repo, result, task, graph, loadedRepositorySpecifier, saveStatus]);

  const includedCount = result?.slice.length ?? 0;
  const excludedCount = result?.excluded.length ?? 0;
  const reduction = result?.widened ? 0 : result?.savedPct ?? 0;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-ink/[0.82] backdrop-blur-2xl">
        <div className="mx-auto flex h-[72px] max-w-[1480px] items-center justify-between px-4 sm:px-7">
          <Link href="/workspace" className="flex items-center gap-3 text-paper">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <Image src="/locus-mark.svg" width={22} height={22} alt="" priority />
            </span>
            <span>
              <span className="block text-sm font-semibold tracking-[-0.03em]">Locus</span>
              <span className="block font-mono text-[8px] uppercase tracking-[0.18em] text-muted">
                context-native agent
              </span>
            </span>
          </Link>

          <nav className="flex items-center gap-1 text-xs">
            <Link href="/workspace" className="hidden rounded-lg bg-white/[0.06] px-3 py-2 font-medium text-paper sm:block">
              Workspace
            </Link>
            <Link href="/projects" className="hidden rounded-lg px-3 py-2 text-muted-light hover:text-paper sm:block">
              Runs
            </Link>
            <Link href="/settings" className="hidden rounded-lg px-3 py-2 text-muted-light hover:text-paper sm:block">
              Settings
            </Link>
            <a href={REPO_URL} className="hidden rounded-lg px-3 py-2 text-muted-light hover:text-paper md:block">
              GitHub
            </a>
            <span className="mx-2 hidden h-5 w-px bg-line-strong sm:block" />
            {accountName && (
              <span className="mr-2 hidden max-w-36 truncate text-muted sm:block">{accountName}</span>
            )}
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "h-8 w-8 border border-line-strong",
                  userButtonPopoverCard: "border border-line-strong bg-surface text-paper shadow-2xl",
                },
              }}
            />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1480px] px-4 pb-16 sm:px-7">
        <section className="grid gap-8 border-b border-line-strong py-10 lg:grid-cols-[minmax(0,1fr)_minmax(440px,0.78fr)] lg:items-center lg:gap-14 lg:py-16">
          <div className="relative">
            <div className="mb-7 flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-accent/30 bg-accent/[0.08] px-3 py-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-accent">
                {isWorkspace ? "Agent workspace" : "Public beta"}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                Localize / Implement / Prove
              </span>
            </div>
            <h1 className="max-w-4xl text-5xl font-semibold leading-[0.9] tracking-[-0.07em] text-paper sm:text-6xl lg:text-[78px]">
              Less code in.
              <span className="block bg-gradient-to-r from-accent via-[#91d6ff] to-[#8b9fff] bg-clip-text text-transparent">
                Complete work out.
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-muted-light sm:text-lg">
              Locus turns a repository into the smallest safe working set, completes the task
              in an isolated agent, and proves exactly what changed—and what never entered context.
            </p>
            <div className="mt-8 grid max-w-xl gap-px overflow-hidden rounded-2xl border border-line-strong bg-line sm:grid-cols-3">
              {[
                ["01", "Context localized"],
                ["02", "Agent implements"],
                ["03", "Checks verified"],
              ].map(([step, label]) => (
                <div key={step} className="bg-surface/80 px-4 py-3.5">
                  <p className="font-mono text-[9px] text-accent">{step}</p>
                  <p className="mt-1 text-xs font-medium text-paper">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <ContextLens
            included={includedCount}
            excluded={excludedCount}
            reduction={reduction}
            active={Boolean(result)}
          />
        </section>

        <section className="grid gap-6 py-8 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[390px_minmax(0,1fr)]">
          <aside className="self-start lg:sticky lg:top-23">
            <div className="overflow-hidden rounded-[24px] border border-line-strong bg-surface/90 shadow-[0_28px_90px_rgba(0,0,0,0.22)] backdrop-blur-xl">
              <div className="border-b border-line px-5 py-4">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
                  Task brief
                </p>
                <h2 className="mt-1 text-lg font-semibold tracking-[-0.025em] text-paper">
                  What should the agent change?
                </h2>
              </div>

              <div className="space-y-6 p-5">
                <div>
                  <label htmlFor="repo-input" className="flex items-center justify-between text-xs font-medium text-paper">
                    <span>GitHub repository</span>
                    <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted">01</span>
                  </label>
                  <div className="mt-2 flex gap-2">
                    <input
                      id="repo-input"
                      value={ghUrl}
                      onChange={(event) => setGhUrl(event.target.value)}
                      onKeyDown={(event) => event.key === "Enter" && !loading && loadGithub()}
                      placeholder="owner/repository"
                      className="min-w-0 flex-1 rounded-xl border border-line-strong bg-ink px-3 py-3 text-sm text-paper placeholder:text-muted focus:border-accent focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => loadGithub()}
                      disabled={loading || !ghUrl.trim()}
                      className="rounded-xl bg-paper px-3.5 py-3 text-xs font-semibold text-ink transition hover:bg-accent hover:text-ink disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      {loading ? "…" : "Load"}
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {bundled.map((source) => (
                      <button
                        type="button"
                        key={source.slug}
                        onClick={() => pickBundled(source.slug)}
                        className={`rounded-full border px-2.5 py-1 text-[10px] transition ${
                          repo?.slug === source.slug
                            ? "border-accent bg-accent text-ink"
                            : "border-line-strong text-muted hover:text-paper"
                        }`}
                      >
                        {source.name}
                      </button>
                    ))}
                  </div>
                  {recentRepos.length > 0 && (
                    <div className="mt-3 border-t border-line pt-3">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted">Recent</span>
                        <button type="button" onClick={clearRecents} className="text-[10px] text-muted hover:text-paper">
                          Clear
                        </button>
                      </div>
                      <div className="mt-2 space-y-1">
                        {recentRepos.slice(0, 3).map((identifier) => (
                          <button
                            type="button"
                            key={identifier}
                            onClick={() => loadRecent(identifier)}
                            className="block w-full truncate text-left font-mono text-[10px] text-muted-light hover:text-accent"
                          >
                            {identifier}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="task-input" className="flex items-center justify-between text-xs font-medium text-paper">
                    <span>Engineering task</span>
                    <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted">02 · ⌘K</span>
                  </label>
                  <textarea
                    ref={taskInputRef}
                    id="task-input"
                    value={task}
                    onChange={(event) => setTask(event.target.value)}
                    maxLength={5_000}
                    rows={5}
                    placeholder="Describe the bug, desired behavior, and what proves it is fixed."
                    className="mt-2 w-full resize-y rounded-xl border border-line-strong bg-ink px-3 py-3 text-sm leading-6 text-paper placeholder:text-muted focus:border-accent focus:outline-none"
                  />
                  {examples.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setTask(examples[0])}
                      className="mt-2 text-left text-[10px] leading-4 text-muted transition hover:text-accent"
                    >
                      Try: “{examples[0]}”
                    </button>
                  )}
                  <TaskEvidence evidence={evidence} onAdd={addEvidence} onRemove={removeEvidence} />
                </div>
              </div>

              {(error || note) && (
                <div
                  role={error ? "alert" : "status"}
                  className={`border-t border-line px-5 py-3 text-xs leading-5 ${
                    error ? "text-recent" : "text-muted-light"
                  }`}
                >
                  {error ?? note}
                </div>
              )}
            </div>
          </aside>

          <div className="min-w-0 space-y-6">
            {graph && result ? (
              <>
                <section className="overflow-hidden rounded-[22px] border border-line-strong bg-surface">
                  <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
                        Scope aperture
                      </p>
                      <p className="mt-1 truncate text-sm font-semibold text-paper">{repo?.name}</p>
                    </div>
                    {loadedRepositorySpecifier && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={saveAnalysis}
                          disabled={saveStatus === "saving"}
                          className="rounded-lg border border-line-strong px-3 py-2 text-[11px] text-muted-light hover:border-accent hover:text-paper disabled:opacity-40"
                        >
                          {saveStatus === "idle" ? "Save" : saveStatus}
                        </button>
                        <button
                          type="button"
                          onClick={copyShareView}
                          className="rounded-lg border border-line-strong px-3 py-2 text-[11px] text-muted-light hover:border-accent hover:text-paper"
                        >
                          {shareStatus === "idle" ? "Share view" : shareStatus}
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-px bg-line xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
                    <div className="min-w-0 bg-surface p-4 sm:p-5">
                      <DependencyGraph
                        graph={graph}
                        result={result}
                        selected={selected}
                        onSelect={setSelected}
                        onRefineTask={refineTask}
                      />
                    </div>
                    <div className="min-w-0 bg-surface p-4 sm:p-5">
                      <FilePanel
                        result={result}
                        repo={repo}
                        selected={selected}
                        onSelect={setSelected}
                      />
                    </div>
                  </div>
                </section>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_360px]">
                  <AgentRunPanel
                    repository={loadedRepositorySpecifier}
                    task={task}
                    sliceCount={includedCount}
                    excludedCount={excludedCount}
                    estimatedSavedPct={reduction}
                  />
                  <TokenMeter
                    result={result}
                    repo={repo}
                    sparse={graph.edges.length / Math.max(1, graph.nodes.length) < 0.6}
                  />
                </div>
              </>
            ) : (
              <div className="grid min-h-[520px] place-items-center rounded-[22px] border border-dashed border-line-strong bg-surface p-10 text-center">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">Waiting for a repository</p>
                  <p className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-paper">
                    {loading ? "Reading the code graph…" : "Load a repository to open the scope ledger."}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-line-strong bg-surface">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-3 px-4 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <span>Locus · less context, complete work</span>
          <nav className="flex gap-4">
            <Link href="/docs" className="hover:text-accent">Docs</Link>
            <Link href="/privacy" className="hover:text-accent">Privacy</Link>
            <Link href="/terms" className="hover:text-accent">Terms</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

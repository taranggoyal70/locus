"use client";

import { UserButton } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { AgentRunPanel } from "@/components/AgentRunPanel";
import { ContextLens } from "@/components/ContextLens";
import { DependencyGraph } from "@/components/DependencyGraph";
import { FilePanel } from "@/components/FilePanel";
import { RepoLoadFeedback } from "@/components/RepoLoadFeedback";
import { TaskEvidence } from "@/components/TaskEvidence";
import { TokenMeter } from "@/components/TokenMeter";
import { useLocus } from "@/hooks/useLocus";
import { REPO_URL } from "@/lib/config";
import { NO_RUN_ACCESS, type RunAccess } from "@/lib/run-access";
import { buildShareUrl } from "@/lib/share";

type LocusAppProps = {
  accountName?: string;
  isWorkspace?: boolean;
  initialRunId?: string | null;
  runAccess?: RunAccess;
};

export function LocusApp({
  accountName,
  isWorkspace = false,
  initialRunId = null,
  runAccess = NO_RUN_ACCESS,
}: LocusAppProps) {
  const {
    repo,
    graph,
    result,
    task,
    selected,
    ghUrl,
    loadedRepositorySpecifier,
    loading,
    loadIssue,
    note,
    evidence,
    examples,
    bundled,
    setTask,
    setSelected,
    setGhUrl,
    pickBundled,
    loadGithub,
    retryRepoLoad,
    addEvidence,
    removeEvidence,
    recentRepos,
    clearRecents,
    loadRecent,
  } = useLocus();
  const [shareStatus, setShareStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [saveStatus, setSaveStatus] = useState("idle");
  const [definitionOfDone, setDefinitionOfDone] = useState(
    "The requested behavior works as described\nRelevant automated checks pass",
  );
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
  const includedShare = result?.totalTokens
    ? Math.round((result.sliceTokens / result.totalTokens) * 100)
    : 0;

  return (
    <div className="locus-shell min-h-screen lg:grid lg:grid-cols-[92px_minmax(0,1fr)]">
      <header className="locus-rail sticky top-0 z-40 flex h-16 items-center justify-between border-b border-[#14233b]/15 px-4 lg:h-screen lg:flex-col lg:border-b-0 lg:border-r lg:px-0 lg:py-5">
          <Link href="/workspace" aria-label="Locus workspace" className="flex items-center gap-2.5 text-[#14233b] lg:flex-col">
            <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-[#14233b] shadow-[0_8px_20px_rgba(20,35,59,.18)]">
              <Image src="/locus-mark.svg" width={22} height={22} alt="" priority />
            </span>
            <span className="text-sm font-bold tracking-[-0.04em] lg:text-[11px]">LOCUS</span>
          </Link>

          <nav className="flex items-center gap-1 text-[10px] font-semibold text-[#52647a] lg:flex-col lg:gap-2">
            <Link href="/workspace" className="rounded-xl bg-[#14233b] px-3 py-2.5 text-white lg:grid lg:h-14 lg:w-16 lg:place-items-center lg:px-0">
              Map
            </Link>
            <Link href="/projects" className="hidden rounded-xl px-3 py-2.5 hover:bg-white/50 hover:text-[#14233b] sm:block lg:grid lg:h-14 lg:w-16 lg:place-items-center lg:px-0">
              Runs
            </Link>
            <Link href="/settings" className="hidden rounded-xl px-3 py-2.5 hover:bg-white/50 hover:text-[#14233b] sm:block lg:grid lg:h-14 lg:w-16 lg:place-items-center lg:px-0">
              Setup
            </Link>
            <a href={REPO_URL} className="hidden rounded-xl px-3 py-2.5 hover:bg-white/50 hover:text-[#14233b] md:block lg:grid lg:h-14 lg:w-16 lg:place-items-center lg:px-0">
              Code
            </a>
          </nav>

          <div className="flex items-center gap-2 lg:flex-col">
            {accountName && <span className="hidden max-w-16 truncate text-[9px] font-medium text-[#52647a] lg:block">{accountName}</span>}
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "h-8 w-8 border border-[#14233b]/20",
                  userButtonPopoverCard: "border border-line-strong bg-surface text-paper shadow-2xl",
                },
              }}
            />
          </div>
      </header>

      <div className="min-w-0">
      <main className="mx-auto max-w-[1580px] px-4 pb-16 sm:px-7 lg:px-9">
        <section className="grid gap-7 py-8 lg:grid-cols-[minmax(360px,0.72fr)_minmax(560px,1.28fr)] lg:items-center lg:gap-9 lg:py-10">
          <div className="relative py-2">
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-[#14233b] px-3 py-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-[#8ef0c0]">
                {isWorkspace ? "Mission workspace" : "Public early access"}
              </span>
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#52647a]">
                Slice → Run → Evidence
              </span>
            </div>
            <h1 className="max-w-2xl text-5xl font-bold leading-[0.9] tracking-[-0.065em] text-[#14233b] sm:text-6xl lg:text-[72px]">
              Map less.
              <span className="block text-[#314fd1]">Ship the task.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base font-medium leading-7 text-[#40546b]">
              Locus admits a focused Slice, keeps every excluded file visible, then produces a
              check-passing proposal in an isolated Run for you to review.
            </p>
            <div className="mt-7 flex max-w-xl items-center gap-4 border-t border-[#14233b]/20 pt-4">
              <span className="h-2.5 w-2.5 rounded-sm bg-[#314fd1]" />
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-[#52647a]">
                Included is a decision. Excluded is evidence.
              </p>
            </div>
          </div>

          <ContextLens
            included={includedCount}
            excluded={excludedCount}
            includedShare={includedShare}
            active={Boolean(result)}
          />
        </section>

        <section className="locus-stage overflow-hidden rounded-[30px] border border-white/20 bg-[#14233b] p-3 sm:p-4">
          <div className="flex flex-col gap-2 px-2 pb-4 pt-1 sm:flex-row sm:items-center sm:justify-between sm:px-3">
            <div>
              <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-accent">Active mission</p>
              <p className="mt-1 text-sm font-semibold text-paper">{repo?.name ?? "Repository standby"}</p>
            </div>
            <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-light">
              <span className="h-2 w-2 rounded-sm bg-accent" />
              Context engine online
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[390px_minmax(0,1fr)]">
          <aside className="self-start lg:sticky lg:top-23">
            <div className="overflow-hidden rounded-[20px] border border-line-strong bg-surface/95">
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
                  <p className="mt-2 text-[10px] leading-4 text-muted">
                    Public GitHub Repos only during early access. Failed loads keep your current Slice open.
                  </p>
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

                <div>
                  <label htmlFor="definition-of-done" className="flex items-center justify-between text-xs font-medium text-paper">
                    <span>Definition of done</span>
                    <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted">03</span>
                  </label>
                  <textarea
                    id="definition-of-done"
                    value={definitionOfDone}
                    onChange={(event) => setDefinitionOfDone(event.target.value)}
                    maxLength={2_000}
                    rows={3}
                    placeholder="One verifiable outcome per line."
                    className="mt-2 w-full resize-y rounded-xl border border-line-strong bg-ink px-3 py-3 text-sm leading-6 text-paper placeholder:text-muted focus:border-accent focus:outline-none"
                  />
                  <p className="mt-2 text-[10px] leading-4 text-muted">These are proof requirements for review. A passing command does not by itself prove the requested behavior.</p>
                </div>
              </div>

              {loadIssue ? (
                <RepoLoadFeedback
                  issue={loadIssue}
                  activeRepoName={repo?.name ?? null}
                  onRetry={() => retryRepoLoad()}
                  onUseDemo={() => pickBundled(bundled[0].slug)}
                />
              ) : note ? (
                <div
                  role="status"
                  className="border-t border-line px-5 py-3 text-xs leading-5 text-muted-light"
                >
                  {note}
                </div>
              ) : null}
            </div>
          </aside>

          <div className="min-w-0 space-y-6">
            {graph && result ? (
              <>
                <section className="overflow-hidden rounded-[22px] border border-line-strong bg-surface">
                  <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
                        Slice aperture
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
                    initialRunId={initialRunId}
                    runAccess={runAccess}
                    acceptanceCriteria={definitionOfDone.split("\n").map((item) => item.trim()).filter(Boolean)}
                  />
                  <TokenMeter
                    result={result}
                    repo={repo}
                    sparse={result.sparse}
                  />
                </div>
              </>
            ) : (
              <div className="grid min-h-[520px] place-items-center rounded-[22px] border border-dashed border-line-strong bg-surface p-10 text-center">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">Waiting for a repository</p>
                  <p className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-paper">
                    {loading ? "Reading the code graph…" : "Load a repository to open the Slice ledger."}
                  </p>
                </div>
              </div>
            )}
          </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#14233b]/15">
        <div className="mx-auto flex max-w-[1580px] flex-col gap-3 px-4 py-6 text-xs font-medium text-[#52647a] sm:flex-row sm:items-center sm:justify-between sm:px-9">
          <span>Locus · Slice context, complete work</span>
          <nav className="flex gap-4">
            <Link href="/docs" className="hover:text-[#14233b]">Docs</Link>
            <Link href="/privacy" className="hover:text-[#14233b]">Privacy</Link>
            <Link href="/terms" className="hover:text-[#14233b]">Terms</Link>
          </nav>
        </div>
      </footer>
      </div>
    </div>
  );
}

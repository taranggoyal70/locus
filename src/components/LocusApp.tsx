"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { AgentRunPanel } from "@/components/AgentRunPanel";
import { AppShell } from "@/components/AppShell";
import { frame } from "@/components/Datasheet";
import { WorkspaceField } from "@/components/WorkspaceField";
import { DependencyGraph } from "@/components/DependencyGraph";
import { FilePanel } from "@/components/FilePanel";
import { Mascot } from "@/components/Mascot";
import { OnboardingBanner } from "@/components/OnboardingBanner";
import { RepoLoadFeedback } from "@/components/RepoLoadFeedback";
import { TaskEvidence } from "@/components/TaskEvidence";
import { TokenMeter } from "@/components/TokenMeter";
import { useLocus } from "@/hooks/useLocus";
import { NO_RUN_ACCESS, type RunAccess } from "@/lib/run-access";
import { buildShareUrl } from "@/lib/share";

type LocusAppProps = {
  isWorkspace?: boolean;
  initialRunId?: string | null;
  runAccess?: RunAccess;
};

export function LocusApp({
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
    <AppShell>
      {isWorkspace && <OnboardingBanner tier={runAccess.tier} />}
      <main className={`${frame} pb-16 pt-6 sm:pb-24 sm:pt-8`}>
        <h1 className="sr-only">Workspace</h1>

        {/* The command bar: the Repo, then the task. The Slice updates as you type. */}
        <section aria-label="Repo and task" className="overflow-hidden rounded-card border border-line-2 bg-surface shadow-panel">
          <div className="flex flex-col gap-3 border-b border-line p-3 lg:flex-row lg:items-center">
            <div className="flex min-w-0 flex-1 gap-2">
              <label htmlFor="repo-input" className="ws-field min-w-0 flex-1">
                <span className="ws-field-label">Repo</span>
                <span className="sr-only">GitHub repository</span>
                <input
                  id="repo-input"
                  value={ghUrl}
                  onChange={(event) => setGhUrl(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && !loading && loadGithub()}
                  placeholder="owner/repository, public on GitHub"
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
              <button
                type="button"
                onClick={() => loadGithub()}
                disabled={loading || !ghUrl.trim()}
                className="ws-button"
              >
                {loading ? "Loading" : "Load"}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted">Samples</span>
              {bundled.map((source) => (
                <button
                  type="button"
                  key={source.slug}
                  onClick={() => pickBundled(source.slug)}
                  aria-pressed={repo?.slug === source.slug}
                  className="ws-chip"
                >
                  {source.name}
                </button>
              ))}
              {recentRepos.length > 0 && (
                <>
                  <span className="ml-2 mr-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted">Recent</span>
                  {recentRepos.slice(0, 3).map((identifier) => (
                    <button type="button" key={identifier} onClick={() => loadRecent(identifier)} className="ws-chip max-w-[180px] truncate font-mono">
                      {identifier}
                    </button>
                  ))}
                  <button type="button" onClick={clearRecents} className="px-1.5 text-[12px] text-muted transition-colors hover:text-ink">
                    Clear
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="p-3">
            <label htmlFor="task-input" className="ws-field ws-field--task">
              <span className="ws-field-label">Task</span>
              <span className="sr-only">What should the agent change?</span>
              <textarea
                ref={taskInputRef}
                id="task-input"
                value={task}
                onChange={(event) => setTask(event.target.value)}
                maxLength={5_000}
                rows={2}
                placeholder="Describe the change, like a bug report: what happens, and what should."
              />
              <kbd className="ws-kbd" aria-hidden="true">⌘K</kbd>
            </label>
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-1">
              <TaskEvidence evidence={evidence} onAdd={addEvidence} onRemove={removeEvidence} />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {examples.length > 0 && !task.trim() && (
                  <button type="button" onClick={() => setTask(examples[0])} className="ws-chip">
                    Try &ldquo;{examples[0]}&rdquo;
                  </button>
                )}
                {result && loadedRepositorySpecifier && (
                  <>
                    <button type="button" onClick={saveAnalysis} disabled={saveStatus === "saving"} className="ws-chip">
                      {saveStatus === "idle" ? "Save" : saveStatus === "saving" ? "Saving" : saveStatus === "saved" ? "Saved" : saveStatus}
                    </button>
                    <button type="button" onClick={copyShareView} disabled={!task.trim()} className="ws-chip">
                      {shareStatus === "idle" ? "Share link" : shareStatus === "copied" ? "Link copied" : "Copy failed"}
                    </button>
                  </>
                )}
              </div>
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
            <div role="status" className="border-t border-line px-4 py-3 text-[13px] leading-5 text-ink-2">
              {note}
            </div>
          ) : null}
        </section>

        {graph && result ? (
          <>
            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)] lg:items-start">
              <div className="min-w-0 space-y-6">
                <WorkspaceField
                  files={repo ? Object.keys(repo.files) : null}
                  slicePaths={result.slice.map(({ path }) => path)}
                  anchorPaths={result.anchorPaths}
                  loading={loading}
                  repoName={repo?.name ?? null}
                  includedShare={includedShare}
                />
                <TokenMeter result={result} repo={repo} sparse={result.sparse} />
              </div>
              <div className="min-w-0 lg:sticky lg:top-6">
                <FilePanel result={result} repo={repo} selected={selected} onSelect={setSelected} />
              </div>
            </div>

            <div className="mt-6">
              <DependencyGraph graph={graph} result={result} selected={selected} onSelect={setSelected} onRefineTask={refineTask} />
            </div>

            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
              <AgentRunPanel
                repository={loadedRepositorySpecifier}
                task={task}
                sliceCount={includedCount}
                excludedCount={excludedCount}
                initialRunId={initialRunId}
                runAccess={runAccess}
                acceptanceCriteria={definitionOfDone.split("\n").map((item) => item.trim()).filter(Boolean)}
              />
              <section className="rounded-card border border-line-2 bg-surface p-5 sm:p-6">
                <label htmlFor="definition-of-done" className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Definition of done</label>
                <p className="mt-2 text-[14px] leading-6 text-ink-2">What an Agent Run must prove, one outcome per line. A passing command alone does not prove the behavior.</p>
                <textarea
                  id="definition-of-done"
                  value={definitionOfDone}
                  onChange={(event) => setDefinitionOfDone(event.target.value)}
                  maxLength={2_000}
                  rows={4}
                  placeholder="One verifiable outcome per line."
                  className="mt-4 w-full resize-y rounded-chip border border-line-2 bg-canvas px-3 py-2.5 text-[14px] leading-6 text-ink transition-colors duration-150 placeholder:text-muted hover:border-ink/40 focus:border-ink"
                />
              </section>
            </div>
          </>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
            <WorkspaceField files={null} slicePaths={[]} anchorPaths={[]} loading={loading} repoName={null} includedShare={0} />
            <div className="grid min-h-[320px] place-items-center rounded-card border border-dashed border-line-2 bg-surface p-10 text-center">
              <div className="flex flex-col items-center">
                <Mascot mood={loading ? "scan" : "sleep"} size={48} />
                <p className="mt-5 font-display text-[26px] font-normal leading-[1.1] tracking-[-0.012em] text-ink">{loading ? "Reading the Repo" : "No Repo yet"}</p>
                <p className="mt-2 max-w-xs text-[14px] leading-6 text-ink-2">
                  {loading
                    ? "Mapping its files and imports. The Slice opens as soon as it is done."
                    : "Paste a public GitHub Repo above, or open a sample. Its files land here, ranked for your task."}
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

    </AppShell>
  );
}

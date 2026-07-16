"use client";

import { Show, UserButton } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { REPO_URL } from "@/lib/config";
import { DependencyGraph } from "@/components/DependencyGraph";
import { FilePanel } from "@/components/FilePanel";
import { TaskEvidence } from "@/components/TaskEvidence";
import { TokenMeter } from "@/components/TokenMeter";
import { useLocus } from "@/hooks/useLocus";
import { buildShareUrl } from "@/lib/share";
import benchmark from "../../benchmarks/results.json";

const featuredCase = benchmark.results.find((result) => result.featured);

type LocusAppProps = {
  accountName?: string;
  isWorkspace?: boolean;
};

export function LocusApp({ accountName, isWorkspace = false }: LocusAppProps) {
  const {
    repo, graph, result, task, selected, ghUrl, loadedRepositorySpecifier, loading, error, note, evidence,
    examples: bundledExamples, bundled: BUNDLED,
    setTask, setSelected, setGhUrl, pickBundled, loadGithub, loadGithubAt, addEvidence, removeEvidence,
  } = useLocus();
  const [shareStatus, setShareStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const taskInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        taskInputRef.current?.focus();
      }
      if (e.key === "Escape" && selected) {
        setSelected(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selected, setSelected]);
  const presentation = isWorkspace ? {
    homeHref: "/workspace",
    showLandingNavigation: false,
    showMarketing: false,
    badge: "Workspace",
    eyebrow: `Signed in${accountName ? ` as ${accountName}` : ""}`,
    title: "Build the context your agent should read first.",
    description: "Load a public repository, describe the engineering task, and copy the focused context pack into your coding workflow.",
    heroSpacing: "pb-8 pt-10 sm:pt-12",
    titleSpacing: "mt-3 text-4xl sm:text-5xl",
    descriptionSpacing: "mt-4",
    asideLabel: "Account ready",
    asideCopy: "Public repositories only. Analysis runs in memory and is not stored.",
  } : {
    homeHref: "/",
    showLandingNavigation: true,
    showMarketing: true,
    badge: "Open-source beta",
    eyebrow: "Context compiler for coding agents",
    title: "Give your agent a task-sized view of the codebase.",
    description: "Locus traces a task to matching files, imported dependencies, and nearby integration points—before your agent spends tokens reading the repository.",
    heroSpacing: "pb-10 pt-14 sm:pt-20",
    titleSpacing: "mt-5 text-5xl sm:text-6xl lg:text-7xl",
    descriptionSpacing: "mt-6",
    asideLabel: "Operating rule",
    asideCopy: "Focus when evidence is strong. Widen when it is not.",
  };

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
    window.setTimeout(() => setShareStatus("idle"), 2200);
  }

  function replayFeaturedCase() {
    if (!featuredCase) return;
    void loadGithubAt(`${featuredCase.repo}@${featuredCase.snapshot}`, featuredCase.task);
  }

  const saveAnalysis = useCallback(async () => {
    if (!repo || !result || !task.trim() || saveStatus === "saving") return;
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/projects", {
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
      setSaveStatus(res.ok ? "saved" : "failed");
    } catch {
      setSaveStatus("failed");
    }
    setTimeout(() => setSaveStatus("idle"), 2500);
  }, [repo, result, task, graph, loadedRepositorySpecifier, saveStatus]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-ink/[0.88] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 sm:px-8">
          <Link href={presentation.homeHref} className="flex items-center gap-3 text-paper">
            <Image src="/locus-mark.svg" width={28} height={28} alt="" priority />
            <span className="font-semibold tracking-[-0.02em]">Locus</span>
            <span className="hidden rounded-full border border-line-strong px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-light sm:inline-flex">
              {presentation.badge}
            </span>
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            {presentation.showLandingNavigation && <a href="#method" className="hidden rounded-lg px-3 py-2 text-muted-light transition hover:text-paper sm:block">Method</a>}
            <a
              href={REPO_URL}
              className="hidden rounded-lg border border-line-strong px-3 py-2 text-paper transition hover:border-accent/50 hover:text-accent sm:block"
            >
              View source
            </a>
            <Show when="signed-out">
              <Link href="/sign-in" className="rounded-lg px-3 py-2 text-muted-light transition hover:text-paper">
                Log in
              </Link>
              <Link href="/sign-up" className="rounded-lg bg-accent px-3.5 py-2 font-semibold text-ink transition hover:bg-[#b5f34a]">
                Create account
              </Link>
            </Show>
            <Show when="signed-in">
              {presentation.showLandingNavigation ? (
                <Link href="/workspace" className="rounded-lg border border-accent/30 bg-accent/[0.06] px-3 py-2 font-medium text-accent transition hover:bg-accent/[0.1]">
                  Open workspace
                </Link>
              ) : (
                <>
                  <Link href="/projects" className="hidden rounded-lg px-3 py-2 text-muted-light transition hover:text-paper sm:block">
                    Projects
                  </Link>
                  <Link href="/settings" className="hidden rounded-lg px-3 py-2 text-muted-light transition hover:text-paper sm:block">
                    Settings
                  </Link>
                </>
              )}
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "h-9 w-9 border border-line-strong",
                    userButtonPopoverCard: "border border-line-strong bg-surface text-paper shadow-2xl",
                  },
                }}
              />
            </Show>
          </nav>
        </div>
      </header>

      <main id="top">
        <section className={`mx-auto grid max-w-7xl gap-8 px-5 sm:px-8 lg:grid-cols-[minmax(0,1fr)_390px] lg:items-end ${presentation.heroSpacing}`}>
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-accent">
              {presentation.eyebrow}
            </p>
            <h1 className={`max-w-4xl font-semibold leading-[0.98] tracking-[-0.055em] text-paper ${presentation.titleSpacing}`}>
              {presentation.title}
            </h1>
            <p className={`${presentation.descriptionSpacing} max-w-2xl text-base leading-7 text-muted-light sm:text-lg`}>
              {presentation.description}
            </p>
          </div>

          <aside className="rounded-[22px] border border-line-strong bg-surface p-5">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{presentation.asideLabel}</p>
            <p className="mt-4 text-xl font-semibold leading-7 tracking-[-0.025em] text-paper">
              {presentation.asideCopy}
            </p>
            <div className="mt-6 grid grid-cols-3 gap-2 text-center font-mono text-[10px] uppercase tracking-wide text-muted-light">
              <span className="rounded-lg border border-line bg-ink/60 px-2 py-3">Browser</span>
              <span className="rounded-lg border border-line bg-ink/60 px-2 py-3">CLI</span>
              <span className="rounded-lg border border-line bg-ink/60 px-2 py-3">MCP</span>
            </div>
          </aside>
        </section>

        <section id="workspace" className="mx-auto max-w-7xl px-5 pb-8 sm:px-8">
          <div className="overflow-hidden rounded-[24px] border border-line-strong bg-surface shadow-[0_40px_120px_rgba(0,0,0,0.24)]" aria-busy={loading}>
            <div className="flex flex-col gap-4 border-b border-line px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">Build a context pack</p>
                <h2 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-paper">Repository first. Task second.</h2>
              </div>
              {featuredCase && (
                <button
                  onClick={replayFeaturedCase}
                  disabled={loading}
                  className="rounded-lg border border-accent/25 bg-accent/[0.06] px-3 py-2 text-sm font-medium text-accent transition hover:bg-accent/[0.1] disabled:opacity-50"
                >
                  Load benchmark example
                </button>
              )}
            </div>

            <div className="grid gap-px bg-line lg:grid-cols-2">
              <div className="bg-ink/[0.55] p-5 sm:p-6">
                <label htmlFor="repo-input" className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                  01 · Public GitHub repository
                </label>
                <div className="mt-3 flex gap-2">
                  <input
                    id="repo-input"
                    value={ghUrl}
                    onChange={(event) => setGhUrl(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && !loading && loadGithub()}
                    placeholder="owner/repo or owner/repo@commit"
                    className="min-w-0 flex-1 rounded-xl border border-line-strong bg-ink px-4 py-3 text-sm text-paper placeholder:text-muted focus:border-accent/50 focus:outline-none"
                  />
                  <button
                    onClick={() => loadGithub()}
                    disabled={loading || !ghUrl.trim()}
                    aria-label={loading ? "Loading repository" : "Analyze repository"}
                    className="rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-ink transition hover:bg-[#b5f34a] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-ink/30 border-t-ink" />
                        Loading
                      </span>
                    ) : "Analyze"}
                  </button>
                </div>
                <p className="mt-2 text-[11px] leading-5 text-muted">Public repositories only. Repository contents are analyzed in memory and are not saved.</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-muted">Try a sample</span>
                  {BUNDLED.map((source) => (
                    <button
                      key={source.slug}
                      onClick={() => pickBundled(source.slug)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                        repo?.slug === source.slug
                          ? "border-accent/40 bg-accent/[0.08] text-accent"
                          : "border-line-strong text-muted-light hover:text-paper"
                      }`}
                    >
                      {source.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-ink/[0.55] p-5 sm:p-6">
                <label htmlFor="task-input" className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                  02 · Engineering task
                </label>
                <div className="relative mt-3">
                  <input
                    ref={taskInputRef}
                    id="task-input"
                    value={task}
                    onChange={(event) => setTask(event.target.value)}
                    maxLength={500}
                    placeholder="Describe the change or bug in plain language"
                    className="w-full rounded-xl border border-line-strong bg-ink px-4 py-3 pr-16 text-sm text-paper placeholder:text-muted focus:border-accent/50 focus:outline-none"
                  />
                  <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-line-strong px-1.5 py-0.5 font-mono text-[10px] text-muted">
                    {"⌘"}K
                  </kbd>
                </div>
                <TaskEvidence evidence={evidence} onAdd={addEvidence} onRemove={removeEvidence} />
                <div className="mt-3 flex flex-wrap gap-2">
                  {bundledExamples.slice(0, 3).map((example) => (
                    <button
                      key={example}
                      onClick={() => setTask(example)}
                      className="rounded-full border border-line px-2.5 py-1 text-[11px] text-muted transition hover:border-line-strong hover:text-paper"
                    >
                      {example}
                    </button>
                  ))}
                  <span className="self-center text-[11px] text-muted">Results update as you type.</span>
                </div>
              </div>
            </div>

            {(error || note) && (
              <div role={error ? "alert" : "status"} aria-live="polite" className={`border-t border-line px-6 py-3 text-xs ${error ? "text-recent" : "text-muted-light"}`}>
                {error ?? note}
              </div>
            )}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-14 sm:px-8">
          {graph && result ? (
            <>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs text-muted-light">{repo?.name}</p>
                  <p className="mt-1 truncate text-sm text-paper">{task || "No task described"}</p>
                </div>
                {loadedRepositorySpecifier && task.trim() && (
                  <div className="flex gap-2">
                    {isWorkspace && (
                      <button
                        onClick={saveAnalysis}
                        disabled={saveStatus === "saving"}
                        className="shrink-0 rounded-lg border border-line-strong px-3 py-2 text-xs text-muted-light transition hover:border-accent/40 hover:text-paper disabled:opacity-40"
                      >
                        {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved" : saveStatus === "failed" ? "Save failed" : "Save analysis"}
                      </button>
                    )}
                    <button
                      onClick={copyShareView}
                      className="shrink-0 rounded-lg border border-line-strong px-3 py-2 text-xs text-muted-light transition hover:border-accent/40 hover:text-paper"
                    >
                      {shareStatus === "copied"
                        ? "View link copied"
                        : shareStatus === "failed"
                          ? "Copy failed — try again"
                          : "Copy shareable view"}
                    </button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
                <DependencyGraph graph={graph} result={result} selected={selected} onSelect={setSelected} />
                <div className="space-y-5">
                  <TokenMeter result={result} repo={repo} sparse={graph.edges.length / Math.max(1, graph.nodes.length) < 0.6} />
                  <FilePanel result={result} repo={repo} selected={selected} onSelect={setSelected} />
                </div>
              </div>
            </>
          ) : !error ? (
            loading ? (
              <div className="space-y-5">
                <div className="overflow-hidden rounded-[22px] border border-line bg-surface p-6">
                  <div className="skeleton h-4 w-48 mb-4" />
                  <div className="skeleton h-6 w-72 mb-6" />
                  <div className="grid gap-px lg:grid-cols-3">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="p-5">
                        <div className="skeleton h-3 w-16 mb-4" />
                        <div className="skeleton h-4 w-32 mb-3" />
                        <div className="skeleton h-20 w-full" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
                  <div className="skeleton h-48 w-full rounded-[22px]" />
                  <div className="skeleton h-48 w-full rounded-[20px]" />
                </div>
              </div>
            ) : (
              <div role="status" aria-live="polite" className="rounded-[22px] border border-line bg-surface p-16 text-center text-sm text-muted">
                Choose a repository to begin
              </div>
            )
          ) : null}
        </section>

        {presentation.showMarketing && <>
        <section id="method" className="border-y border-line bg-surface/[0.45]">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-accent">Measured, not promised</p>
            <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:items-end">
              <h2 className="max-w-xl text-3xl font-semibold leading-tight tracking-[-0.04em] text-paper sm:text-4xl">
                Historical replay, with the limits left visible.
              </h2>
              <p className="max-w-2xl text-sm leading-6 text-muted-light">
                The benchmark checks whether Locus includes files developers changed next. It does not measure autonomous-agent completion or prove every excluded file was unnecessary.
              </p>
            </div>
            <div className="mt-10 grid gap-px overflow-hidden rounded-[20px] border border-line bg-line sm:grid-cols-3">
              {[
                { value: `${Math.round(benchmark.summary.fixFileRecall * 100)}%`, label: "historical fix-file recall" },
                { value: `${benchmark.summary.medianContextReductionPct}%`, label: "median estimated context reduction" },
                { value: `${benchmark.summary.cases} across ${benchmark.summary.repositories}`, label: "tasks and repositories" },
              ].map((metric) => (
                <div key={metric.label} className="bg-ink/75 p-6">
                  <p className="font-mono text-3xl font-semibold tracking-[-0.04em] text-accent">{metric.value}</p>
                  <p className="mt-2 text-sm text-muted-light">{metric.label}</p>
                </div>
              ))}
            </div>
            <a
              href={`${REPO_URL}/tree/main/benchmarks`}
              className="mt-6 inline-flex text-sm font-medium text-accent hover:underline"
            >
              Inspect the benchmark and reproduce it
            </a>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-accent">Use it for real</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-paper">Before the agent reads.</h2>
              <p className="mt-4 text-sm leading-6 text-muted-light">
                Use the browser for a quick context pack, or run the same deterministic localizer inside the agent loop through the CLI or MCP server.
              </p>
            </div>
            <div className="overflow-hidden rounded-[20px] border border-line-strong bg-surface">
              <div className="border-b border-line px-5 py-4 text-sm font-medium text-paper">Local CLI</div>
              <pre className="overflow-x-auto p-5 font-mono text-xs leading-6 text-muted-light">{`npx locus-context \\
  locate "prevent duplicate signup profile writes" --pack`}</pre>
              <div className="border-t border-line px-5 py-4 text-xs text-muted">
                Zero runtime dependencies. JavaScript and TypeScript repositories are supported.
              </div>
            </div>
          </div>
        </section>
        </>}
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span className="flex items-center gap-2">
            <Image src="/locus-mark.svg" width={20} height={20} alt="" />
            Locus · task-sized context for coding agents
          </span>
          <nav className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-accent">Privacy</Link>
            <Link href="/terms" className="hover:text-accent">Terms</Link>
            <a href={REPO_URL} className="hover:text-accent">GitHub</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

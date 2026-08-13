"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { AgentRunTimeline } from "@/components/AgentRunPanel";
import { RunContextLedger } from "@/components/RunContextLedger";
import { isActiveRun } from "@/lib/agent/run-state";
import type { AgentRunSnapshot, AgentRunSummary } from "@/lib/agent/run-view";

async function fetchRuns(signal?: AbortSignal): Promise<AgentRunSummary[]> {
  const response = await fetch("/api/agent/runs", { signal, cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error ?? "Could not load Runs.");
  return data.runs;
}

async function fetchRun(runId: string, signal?: AbortSignal): Promise<AgentRunSnapshot> {
  const response = await fetch(`/api/agent/runs/${runId}`, { signal, cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error ?? "Could not load Run evidence.");
  return data;
}

async function requestRunCancellation(runId: string): Promise<void> {
  const response = await fetch(`/api/agent/runs/${runId}/cancel`, { method: "POST" });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error ?? "Could not cancel Run.");
}

export function alphaRunStatusLabel(status: string): string {
  if (status === "awaiting_approval") return "ready for review";
  if (status === "rejected") return "rejected by reviewer";
  return status.replaceAll("_", " ");
}

function statusTone(status: string): string {
  if (status === "completed") return "border-accent/35 bg-accent/10 text-accent";
  if (status === "failed" || status === "rejected" || status === "cancelled") return "border-recent/35 bg-recent/10 text-recent";
  if (status === "awaiting_approval") return "border-[#b78a22]/35 bg-[#e8c866]/25 text-[#765a18]";
  return "border-line-strong bg-paper/[0.04] text-muted-light";
}

function runDateLabel(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(value));
}

export function runUsageLabel(totalTokens: number): string {
  return `${totalTokens.toLocaleString("en-US")} tokens used`;
}

export function AgentRunsList() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedRunId = searchParams.get("run");
  const [runs, setRuns] = useState<AgentRunSummary[]>([]);
  const [snapshot, setSnapshot] = useState<AgentRunSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelingRunId, setCancelingRunId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetchRuns(controller.signal)
      .then((nextRuns) => setRuns(nextRuns))
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load Runs.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selectedRunId || !/^[0-9a-f-]{36}$/i.test(selectedRunId)) return;
    const controller = new AbortController();
    void fetchRun(selectedRunId, controller.signal)
      .then((nextSnapshot) => setSnapshot(nextSnapshot))
      .catch((cause) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load Run evidence.");
      });
    return () => controller.abort();
  }, [selectedRunId]);

  function selectRun(runId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("run", runId);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function closeRun() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("run");
    router.replace(params.size ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
  }

  async function cancelRun(runId: string) {
    setError(null);
    setCancelingRunId(runId);
    try {
      await requestRunCancellation(runId);
      setRuns((currentRuns) => currentRuns.map((run) => (
        run.id === runId ? { ...run, status: "cancelled", error: "Cancelled by the user." } : run
      )));
      setSnapshot((currentSnapshot) => (
        currentSnapshot?.run.id === runId
          ? {
              ...currentSnapshot,
              run: { ...currentSnapshot.run, status: "cancelled", error: "Cancelled by the user." },
            }
          : currentSnapshot
      ));
      const [nextRuns, nextSnapshot] = await Promise.all([
        fetchRuns(),
        selectedRunId === runId ? fetchRun(runId) : Promise.resolve(null),
      ]);
      setRuns(nextRuns);
      if (nextSnapshot) setSnapshot(nextSnapshot);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not cancel Run.");
    } finally {
      setCancelingRunId(null);
    }
  }

  if (loading) {
    return <div className="skeleton h-72 w-full rounded-[22px]" />;
  }

  if (runs.length === 0 && !error) {
    return (
      <div className="rounded-[22px] border border-line bg-surface p-12 text-center">
        <p className="text-sm font-medium text-paper">No Agent Runs yet.</p>
        <p className="mt-2 text-xs text-muted-light">Localize a real Repo and start a Run from the workspace.</p>
        <Link href="/workspace" className="mt-5 inline-block rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-ink">
          Start a Run
        </Link>
      </div>
    );
  }

  const summary = snapshot?.artifacts.find((artifact) => artifact.kind === "summary");
  const diff = snapshot?.artifacts.find((artifact) => artifact.kind === "diff");
  const pullRequest = snapshot?.artifacts.find((artifact) => artifact.kind === "pull_request");
  const selectedSnapshot = snapshot?.run.id === selectedRunId ? snapshot : null;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,.82fr)_minmax(380px,1.18fr)]">
      <section className="overflow-hidden rounded-[22px] border border-line-strong bg-surface">
        <div className="border-b border-line px-5 py-4">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">Run ledger</p>
          <p className="mt-1 text-sm text-muted-light">Every attempt, including failures and excluded context.</p>
        </div>
        <div className="max-h-[680px] divide-y divide-line overflow-auto">
          {runs.map((run) => (
            <button
              key={run.id}
              type="button"
              onClick={() => selectRun(run.id)}
              className={`block w-full px-5 py-4 text-left transition hover:bg-paper/[0.035] ${selectedRunId === run.id ? "bg-paper/[0.055]" : ""}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-paper">{run.task?.task ?? "Agent Task"}</p>
                  <p className="mt-1 truncate font-mono text-[10px] text-muted">{run.task?.repo_url ?? "Unknown Repo"}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-1 font-mono text-[8px] font-semibold uppercase tracking-[0.12em] ${statusTone(run.status)}`}>
                  {alphaRunStatusLabel(run.status)}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[9px] text-muted">
                <span>{run.included_files.length} in</span>
                <span>{run.excluded_files.length} out</span>
                <span>{runUsageLabel(run.tokens.totalTokens)}</span>
                <span>{runDateLabel(run.created_at)}</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="min-h-[520px] overflow-hidden rounded-[22px] border border-line-strong bg-surface">
        {selectedRunId && !selectedSnapshot ? (
          <div className="grid min-h-[520px] place-items-center text-sm text-muted">Loading Run evidence…</div>
        ) : selectedSnapshot ? (
          <>
            <div className="flex items-start justify-between gap-5 border-b border-line px-5 py-4">
              <div className="min-w-0">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">Durable evidence</p>
                <h2 className="mt-1 truncate text-lg font-semibold text-paper">{selectedSnapshot.task?.task ?? "Agent Run"}</h2>
                <p className="mt-1 truncate font-mono text-[10px] text-muted">{selectedSnapshot.task?.repo_url}</p>
              </div>
              <button type="button" onClick={closeRun} className="text-xs text-muted hover:text-paper">Close</button>
            </div>
            <div className="space-y-5 p-5">
              <AgentRunTimeline status={selectedSnapshot.run.status} steps={selectedSnapshot.steps} />
              <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line">
                <div className="bg-ink p-3"><p className="font-mono text-[9px] text-muted">CONTEXT</p><p className="mt-1 text-sm font-semibold text-paper">{selectedSnapshot.run.included_files.length} in</p></div>
                <div className="bg-ink p-3"><p className="font-mono text-[9px] text-muted">OUTSIDE</p><p className="mt-1 text-sm font-semibold text-paper">{selectedSnapshot.run.excluded_files.length} out</p></div>
                <div className="bg-ink p-3"><p className="font-mono text-[9px] text-muted">TOKENS</p><p className="mt-1 text-sm font-semibold text-paper">{selectedSnapshot.tokens.totalTokens.toLocaleString("en-US")}</p></div>
              </div>
              <RunContextLedger
                included={selectedSnapshot.run.included_files}
                excluded={selectedSnapshot.run.excluded_files}
                widened={selectedSnapshot.run.widened_files}
              />
              <p className="rounded-xl border border-line-strong bg-ink/60 px-3 py-2.5 text-[11px] leading-5 text-muted-light">
                Token usage is factual. Locus does not publish a Savings claim during the controlled alpha.
              </p>
              {summary?.content && <p className="text-sm leading-6 text-muted-light">{summary.content}</p>}
              {diff?.content && (
                <details className="rounded-xl border border-line">
                  <summary className="cursor-pointer px-3 py-3 text-xs font-medium text-paper">Review proposed diff</summary>
                  <pre className="max-h-80 overflow-auto border-t border-line p-3 font-mono text-[10px] leading-5 text-muted-light">{diff.content}</pre>
                </details>
              )}
              {selectedSnapshot.run.error && <p role="alert" className="text-xs leading-5 text-recent">{selectedSnapshot.run.error}</p>}
              {selectedSnapshot.run.status === "awaiting_approval" && (
                <p className="rounded-xl border border-line-strong bg-ink px-4 py-3 text-xs leading-5 text-muted-light">
                  Ready for review. External GitHub writes remain disabled during the controlled alpha.
                </p>
              )}
              {pullRequest?.url && <a href={pullRequest.url} target="_blank" rel="noreferrer" className="flex w-full items-center justify-between rounded-xl bg-accent px-4 py-3.5 text-sm font-semibold text-ink"><span>{pullRequest.label}</span><span aria-hidden>↗</span></a>}
              {isActiveRun(selectedSnapshot.run.status) && (
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Link href={`/workspace?run=${selectedSnapshot.run.id}`} className="text-xs font-medium text-accent hover:underline">Resume this Run in the workspace</Link>
                  <button
                    type="button"
                    onClick={() => void cancelRun(selectedSnapshot.run.id)}
                    disabled={cancelingRunId === selectedSnapshot.run.id}
                    className="rounded-xl border border-recent/35 px-3 py-2 text-xs font-medium text-recent transition hover:bg-recent/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {cancelingRunId === selectedSnapshot.run.id ? "Cancelling..." : "Cancel Run"}
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="grid min-h-[520px] place-items-center px-8 text-center">
            <div><p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">Select a Run</p><p className="mt-3 text-xl font-semibold text-paper">Open its complete evidence ledger.</p></div>
          </div>
        )}
      </section>
      {error && <p role="alert" className="lg:col-span-2 rounded-xl border border-recent/30 bg-recent/10 px-4 py-3 text-xs text-recent">{error}</p>}
    </div>
  );
}

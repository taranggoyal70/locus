"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { AgentRunTimeline } from "@/components/AgentRunPanel";
import { dangerButton, monoLabel, monoMeta, primaryButton, ruledList, ruledRow, textLink } from "@/components/controls";
import { EmptyState, InlineError } from "@/components/EmptyState";
import { Mascot } from "@/components/Mascot";
import { ProposalPatch } from "@/components/ProposalPatch";
import { ProposalReview } from "@/components/ProposalReview";
import { RunContextLedger } from "@/components/RunContextLedger";
import { StateTag, type StateTone } from "@/components/StateTag";
import { isActiveRun, type RunStatus } from "@/lib/agent/run-state";
import type { AgentRunSnapshot, AgentRunSummary } from "@/lib/agent/run-view";

async function fetchRuns(signal?: AbortSignal): Promise<AgentRunSummary[]> {
  const response = await fetch("/api/agent/runs", { signal, cache: "no-store" });
  // A failed response may have no JSON body at all. Its parser error ("Unexpected
  // end of JSON input") is not something to show a person.
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new Error(data?.error ?? "Could not load Runs.");
  return data.runs;
}

async function fetchRun(runId: string, signal?: AbortSignal): Promise<AgentRunSnapshot> {
  const response = await fetch(`/api/agent/runs/${runId}`, { signal, cache: "no-store" });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new Error(data?.error ?? "Could not load Run evidence.");
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

function statusTone(status: string): StateTone {
  if (status === "completed") return "passed";
  if (status === "failed" || status === "rejected" || status === "cancelled") return "failed";
  if (status === "awaiting_approval") return "widened";
  return isActiveRun(status as RunStatus) ? "active" : "neutral";
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

  async function refreshRun(runId: string) {
    const [nextRuns, nextSnapshot] = await Promise.all([fetchRuns(), fetchRun(runId)]);
    setRuns(nextRuns);
    setSnapshot(nextSnapshot);
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
    return (
      <div className={`lg:w-[42%] ${ruledList}`}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={`py-5 ${ruledRow}`}>
            <div className="skeleton h-4 w-3/4 rounded-chip" />
            <div className="skeleton mt-3 h-3.5 w-1/2 rounded-chip" />
          </div>
        ))}
      </div>
    );
  }

  if (runs.length === 0 && !error) {
    return (
      <EmptyState
        title="No Agent Runs yet."
        action={<Link href="/workspace" className={primaryButton}>Start a Run</Link>}
      >
        Localize a real Repo and start a Run from the workspace.
      </EmptyState>
    );
  }

  const summary = snapshot?.artifacts.find((artifact) => artifact.kind === "summary");
  const diff = snapshot?.artifacts.find((artifact) => artifact.kind === "diff");
  const pullRequest = snapshot?.artifacts.find((artifact) => artifact.kind === "pull_request");
  const selectedSnapshot = snapshot?.run.id === selectedRunId ? snapshot : null;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
      <section aria-labelledby="run-ledger-title" className="min-w-0">
        <div className="flex items-baseline justify-between gap-4 pb-3">
          <h2 id="run-ledger-title" className={monoLabel}>Run ledger</h2>
          <p className={monoMeta}>{runs.length} {runs.length === 1 ? "Run" : "Runs"}</p>
        </div>
        <p className="pb-4 text-[14px] leading-6 text-ink-2">Every attempt, including failures and excluded context.</p>
        {error && runs.length === 0 ? (
          <InlineError className="border-t border-ink pt-5">{error}</InlineError>
        ) : (
          <ul className={ruledList}>
            {runs.map((run) => {
              const selected = selectedRunId === run.id;
              return (
                <li key={run.id} className={ruledRow}>
                  <button
                    type="button"
                    onClick={() => selectRun(run.id)}
                    aria-current={selected ? "true" : undefined}
                    className={`block w-full px-3 py-4 text-left transition-colors duration-150 sm:px-4 ${
                      selected ? "bg-surface shadow-[inset_2px_0_0_var(--ink)]" : "hover:bg-surface/70"
                    }`}
                  >
                    {/* On phones the state sits above the title, so the title keeps the full width. */}
                    <div className="flex flex-col-reverse items-start gap-2 sm:flex-row sm:justify-between sm:gap-4">
                      <p className="line-clamp-2 min-w-0 text-[15px] font-medium leading-6 text-ink">{run.task?.task ?? "Agent Task"}</p>
                      <StateTag tone={statusTone(run.status)} pulse={isActiveRun(run.status as RunStatus)}>{alphaRunStatusLabel(run.status)}</StateTag>
                    </div>
                    <p className="mt-1 truncate font-mono text-[12px] text-ink-2">{run.task?.repo_url ?? "Unknown Repo"}</p>
                    <p className={`mt-2 flex flex-wrap gap-x-4 gap-y-1 ${monoMeta}`}>
                      <span><span className="text-included-ink">{run.included_files.length}</span> in</span>
                      <span>{run.excluded_files.length} out</span>
                      <span>{runUsageLabel(run.tokens.totalTokens)}</span>
                      <span>{runDateLabel(run.created_at)}</span>
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-label="Run evidence" className="min-w-0 self-start rounded-card border border-line-2 bg-surface lg:sticky lg:top-[84px]">
        {selectedRunId && !selectedSnapshot && !error ? (
          <div className="grid min-h-[420px] place-items-center text-[14px] text-muted">
            <span className="flex items-center gap-3"><Mascot mood="scan" size={24} />Loading Run evidence…</span>
          </div>
        ) : selectedRunId && !selectedSnapshot && error && runs.length > 0 ? (
          <div className="grid min-h-[420px] place-items-center px-8 py-12">
            <InlineError>{error}</InlineError>
          </div>
        ) : selectedSnapshot ? (
          <>
            <div className="border-b border-line p-6 sm:p-7">
              <div className="flex items-center justify-between gap-4">
                <p className={monoLabel}>Durable evidence</p>
                <button type="button" onClick={closeRun} className="rounded-chip px-2 py-1 text-[13px] text-muted transition-colors duration-150 hover:text-ink">Close</button>
              </div>
              <h2 className="mt-4 font-display text-[clamp(24px,2.4vw,30px)] font-normal leading-[1.1] tracking-[-0.012em] text-ink">{selectedSnapshot.task?.task ?? "Agent Run"}</h2>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <StateTag tone={statusTone(selectedSnapshot.run.status)} pulse={isActiveRun(selectedSnapshot.run.status)}>
                  {alphaRunStatusLabel(selectedSnapshot.run.status)}
                </StateTag>
                <p className="min-w-0 truncate font-mono text-[12px] text-ink-2">{selectedSnapshot.task?.repo_url}</p>
              </div>
            </div>
            <div className="space-y-7 p-6 sm:p-7">
              <AgentRunTimeline status={selectedSnapshot.run.status} steps={selectedSnapshot.steps} />
              <dl className="grid grid-cols-3 border-y border-line">
                {[
                  ["In the Slice", selectedSnapshot.run.included_files.length.toLocaleString("en-US"), "text-included-ink"],
                  ["Left out", selectedSnapshot.run.excluded_files.length.toLocaleString("en-US"), "text-ink"],
                  ["Tokens", selectedSnapshot.tokens.totalTokens.toLocaleString("en-US"), "text-ink"],
                ].map(([name, value, tone], index) => (
                  <div key={name} className={`flex flex-col-reverse py-4 ${index > 0 ? "border-l border-line pl-4" : "pr-4"}`}>
                    <dt className={`mt-1.5 ${monoLabel}`}>{name}</dt>
                    <dd className={`font-display text-[clamp(24px,2.6vw,32px)] leading-none tracking-[-0.02em] tabular-nums ${tone}`}>{value}</dd>
                  </div>
                ))}
              </dl>
              <RunContextLedger
                included={selectedSnapshot.run.included_files}
                excluded={selectedSnapshot.run.excluded_files}
                widened={selectedSnapshot.run.widened_files}
              />
              <p className="font-mono text-[11px] leading-5 text-muted">
                Token usage is factual. Locus does not publish a Savings claim during early access.
              </p>
              {summary?.content && <p className="text-[15px] leading-6 text-ink-2">{summary.content}</p>}
              {diff?.content && (
                <details className="group rounded-card border border-line-2">
                  <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-[14px] font-medium text-ink">
                    Review proposed diff
                    <span aria-hidden className="font-mono text-[12px] text-muted transition-transform duration-150 group-open:rotate-90">›</span>
                  </summary>
                  <pre className="max-h-80 overflow-auto border-t border-line bg-canvas p-4 font-mono text-[12px] leading-5 text-ink-2" tabIndex={0}>{diff.content}</pre>
                </details>
              )}
              {selectedSnapshot.run.error && <InlineError>{selectedSnapshot.run.error}</InlineError>}
              <ProposalPatch key={selectedSnapshot.run.id} snapshot={selectedSnapshot} />
              {/* The evidence and the decision belong on one page: this used to say
                  "Ready for review" with nothing on it to review with. */}
              {selectedSnapshot.run.status === "awaiting_approval"
                && selectedSnapshot.run.proposal_hash
                && selectedSnapshot.task && (
                <ProposalReview
                  key={selectedSnapshot.run.proposal_hash}
                  runId={selectedSnapshot.run.id}
                  proposalHash={selectedSnapshot.run.proposal_hash}
                  acceptanceCriteria={selectedSnapshot.task.acceptance_criteria}
                  onDecided={() => refreshRun(selectedSnapshot.run.id)}
                />
              )}
              {pullRequest?.url && <a href={pullRequest.url} target="_blank" rel="noreferrer" className={`w-full justify-between ${primaryButton}`}><span>{pullRequest.label}</span><span aria-hidden>↗</span></a>}
              {isActiveRun(selectedSnapshot.run.status) && (
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line pt-5">
                  <Link href={`/workspace?run=${selectedSnapshot.run.id}`} className={`text-[14px] ${textLink}`}>Resume this Run in the workspace</Link>
                  <button
                    type="button"
                    onClick={() => void cancelRun(selectedSnapshot.run.id)}
                    disabled={cancelingRunId === selectedSnapshot.run.id}
                    className={dangerButton}
                  >
                    {cancelingRunId === selectedSnapshot.run.id ? "Cancelling..." : "Cancel Run"}
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="grid min-h-[420px] place-items-center px-8 py-12 text-center">
            <div className="flex flex-col items-center">
              <Mascot mood="look" size={40} />
              <p className={`mt-5 ${monoLabel}`}>Select a Run</p>
              <p className="mt-3 font-display text-[26px] leading-[1.1] tracking-[-0.012em] text-ink">Open its complete evidence ledger.</p>
            </div>
          </div>
        )}
      </section>
      {error && runs.length > 0 && !(selectedRunId && !selectedSnapshot) && <InlineError className="lg:col-span-2">{error}</InlineError>}
    </div>
  );
}

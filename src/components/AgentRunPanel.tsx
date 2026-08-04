"use client";

import { useEffect, useState } from "react";

import { RunContextLedger } from "@/components/RunContextLedger";
import { isActiveRun, type RunStatus } from "@/lib/agent/run-state";
import type { AgentRunSnapshot, AgentStepView } from "@/lib/agent/run-view";

const PHASES: Array<{ label: string; statuses: RunStatus[] }> = [
  { label: "Locate", statuses: ["queued", "localizing"] },
  { label: "Prepare", statuses: ["planning"] },
  { label: "Implement", statuses: ["executing"] },
  { label: "Verify", statuses: ["verifying"] },
  { label: "Review", statuses: ["awaiting_approval", "completed"] },
];

function phaseIndex(status: RunStatus): number {
  if (status === "failed" || status === "cancelled") return -1;
  return Math.max(0, PHASES.findIndex((phase) => phase.statuses.includes(status)));
}

export function AgentRunTimeline({
  status,
  steps,
}: {
  status: RunStatus;
  steps: AgentStepView[];
}) {
  const active = phaseIndex(status);
  return (
    <div>
      <ol className="grid grid-cols-5 gap-1" aria-label="Agent run lifecycle">
        {PHASES.map((phase, index) => {
          const complete = active > index || status === "completed";
          const current = active === index && status !== "completed";
          return (
            <li key={phase.label} className="min-w-0">
              <div
                className={`h-1.5 rounded-full ${
                  complete ? "bg-accent" : current ? "bg-recent" : "bg-excluded"
                }`}
              />
              <p className={`mt-2 truncate font-mono text-[9px] uppercase tracking-[0.12em] ${
                current ? "text-recent" : complete ? "text-paper" : "text-muted"
              }`}>
                {phase.label}{current ? " · Working" : ""}
              </p>
            </li>
          );
        })}
      </ol>
      <div className="mt-5 space-y-2">
        {steps.map((step) => (
          <div
            key={step.id}
            className="flex items-center justify-between gap-3 border-l-2 border-line-strong py-1 pl-3"
          >
            <span className="text-xs text-paper">{step.title}</span>
            <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
              {step.status === "running" ? "Working" : step.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AgentRunPanel({
  repository,
  task,
  sliceCount,
  excludedCount,
  initialRunId = null,
  acceptanceCriteria,
  canStartRun,
}: {
  repository: string | null;
  task: string;
  sliceCount: number;
  excludedCount: number;
  initialRunId?: string | null;
  acceptanceCriteria: string[];
  canStartRun: boolean;
}) {
  const [runId, setRunId] = useState<string | null>(initialRunId);
  const [snapshot, setSnapshot] = useState<AgentRunSnapshot | null>(null);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = snapshot?.run.status ?? null;
  const shouldPoll = Boolean(runId) && (!status || isActiveRun(status));

  function rememberRun(nextRunId: string) {
    setRunId(nextRunId);
    const url = new URL(window.location.href);
    url.searchParams.set("run", nextRunId);
    window.history.replaceState(null, "", url);
  }

  useEffect(() => {
    if (!runId || !shouldPoll) return;
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      try {
        const response = await fetch(`/api/agent/runs/${runId}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const data = await response.json() as AgentRunSnapshot & { error?: string };
        if (!response.ok) throw new Error(data?.error ?? "Could not refresh the run.");
        setSnapshot(data);
        if (isActiveRun(data.run.status)) {
          timeout = setTimeout(poll, 2_000);
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Could not refresh the run.");
        }
      }
    }

    void poll();
    return () => {
      controller.abort();
      if (timeout) clearTimeout(timeout);
    };
  }, [runId, shouldPoll]);

  async function launch() {
    if (!canStartRun || !repository || task.trim().length < 10 || launching) return;
    setLaunching(true);
    setError(null);
    setSnapshot(null);
    try {
      const response = await fetch("/api/agent/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repository,
          task,
          acceptanceCriteria,
        }),
      });
      const data = await response.json();
      const createdRunId = data?.run?.id ?? data?.runId;
      if (createdRunId) rememberRun(createdRunId);
      if (!response.ok) throw new Error(data?.error ?? "Could not start the agent.");
      setSnapshot({
        run: data.run,
        steps: [],
        artifacts: [],
        tokens: {
          baselineTokens: 0,
          includedContextTokens: 0,
          inputTokens: 0,
          cachedInputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
        },
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start the agent.");
    } finally {
      setLaunching(false);
    }
  }

  const canLaunch = canStartRun
    && Boolean(repository)
    && task.trim().length >= 10
    && acceptanceCriteria.length > 0;
  const diff = snapshot?.artifacts.find((artifact) => artifact.kind === "diff");
  const summary = snapshot?.artifacts.find((artifact) => artifact.kind === "summary");
  const pullRequest = snapshot?.artifacts.find((artifact) => artifact.kind === "pull_request");
  const repositoryTruncated = snapshot?.steps.some(
    (step) => step.detail.repositoryTruncated === true,
  ) ?? false;

  return (
    <section className="overflow-hidden rounded-[22px] border border-line-strong bg-surface">
      <div className="border-b border-line px-5 py-4">
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
              Agent run
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-[-0.025em] text-paper">
              Turn the Slice into a review-ready proposal.
            </h2>
          </div>
          <span className="rounded-full border border-line-strong px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
            external writes off
          </span>
        </div>
      </div>

      <div className="p-5">
        {!snapshot ? (
          <>
            <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line">
              {[
                ["Context", `${sliceCount} in`],
                ["Outside", `${excludedCount} out`],
                ["Ledger", `${sliceCount + excludedCount} files`],
              ].map(([label, value]) => (
                <div key={label} className="bg-ink px-3 py-3">
                  <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted">{label}</p>
                  <p className="mt-1 text-sm font-semibold text-paper">{value}</p>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={launch}
              disabled={!canLaunch || launching}
              className="mt-4 flex w-full items-center justify-between rounded-xl bg-accent px-4 py-3.5 text-sm font-semibold text-ink transition hover:bg-accent-dim disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span>{launching ? "Starting durable run…" : canStartRun ? "Run task with Locus" : "Invite required"}</span>
              <span aria-hidden>→</span>
            </button>
            <p className="mt-3 text-[11px] leading-5 text-muted">
              {canStartRun
                ? "Executes in an isolated Sandbox. GitHub delivery is disabled during the controlled alpha."
                : "Agent Runs are available only to invited design partners. You can still inspect the complete Slice above."}
            </p>
          </>
        ) : (
          <>
            <AgentRunTimeline status={snapshot.run.status} steps={snapshot.steps} />
            <div className="mt-5 flex items-center justify-between rounded-xl bg-ink px-3 py-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                {snapshot.run.status.replaceAll("_", " ")}
              </span>
              <span className="font-mono text-xs font-semibold text-accent">
                {snapshot.tokens.totalTokens.toLocaleString("en-US")} tokens used
              </span>
            </div>
            <div className="mt-4">
              <RunContextLedger
                included={snapshot.run.included_files}
                excluded={snapshot.run.excluded_files}
                widened={snapshot.run.widened_files}
              />
            </div>
            {repositoryTruncated && (
              <p
                role="alert"
                className="mt-4 rounded-xl border border-recent/40 bg-recent/10 px-3 py-3 text-xs leading-5 text-recent"
              >
                The repository scan reached the controlled-alpha file cap. Some files are outside both
                the included and excluded lists; review the diff carefully or start a narrower run.
              </p>
            )}
            {summary?.content && <p className="mt-4 text-sm leading-6 text-muted-light">{summary.content}</p>}
            {diff?.content && (
              <details className="mt-4 rounded-xl border border-line">
                <summary className="cursor-pointer px-3 py-3 text-xs font-medium text-paper">
                  Review proposed diff
                </summary>
                <pre className="max-h-80 overflow-auto border-t border-line p-3 font-mono text-[10px] leading-5 text-muted-light">
                  {diff.content}
                </pre>
              </details>
            )}
            {snapshot.run.status === "awaiting_approval" && (
              <p className="mt-4 rounded-xl border border-line-strong bg-ink px-4 py-3 text-xs leading-5 text-muted-light">
                Ready for review. External GitHub writes remain disabled during the controlled alpha.
              </p>
            )}
            {pullRequest?.url && (
              <a
                href={pullRequest.url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 flex w-full items-center justify-between rounded-xl bg-accent px-4 py-3.5 text-sm font-semibold text-ink"
              >
                <span>{pullRequest.label}</span>
                <span aria-hidden>↗</span>
              </a>
            )}
            {snapshot.run.error && (
              <p role="alert" className="mt-4 text-xs leading-5 text-recent">{snapshot.run.error}</p>
            )}
          </>
        )}
        {error && <p role="alert" className="mt-3 text-xs text-recent">{error}</p>}
      </div>
    </section>
  );
}

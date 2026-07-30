"use client";

import { useEffect, useState } from "react";

type RunStatus =
  | "queued"
  | "localizing"
  | "planning"
  | "executing"
  | "verifying"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "cancelled";

type AgentStep = {
  id: number;
  sequence: number;
  title: string;
  status: string;
  detail: Record<string, unknown>;
};

type AgentArtifact = {
  id: string;
  kind: string;
  label: string;
  content: string | null;
  url: string | null;
};

type AgentRunResponse = {
  run: {
    id: string;
    status: RunStatus;
    error: string | null;
    included_files: string[];
    excluded_files: string[];
    widened_files: string[];
  };
  steps: AgentStep[];
  artifacts: AgentArtifact[];
  tokens: {
    baselineTokens: number;
    totalTokens: number;
    savedTokens: number;
    savedPct: number;
  };
};

const PHASES: Array<{ label: string; statuses: RunStatus[] }> = [
  { label: "Locate", statuses: ["queued", "localizing"] },
  { label: "Plan", statuses: ["planning"] },
  { label: "Implement", statuses: ["executing"] },
  { label: "Verify", statuses: ["verifying"] },
  { label: "Approve", statuses: ["awaiting_approval", "completed"] },
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
  steps: AgentStep[];
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
  estimatedSavedPct,
}: {
  repository: string | null;
  task: string;
  sliceCount: number;
  excludedCount: number;
  estimatedSavedPct: number;
}) {
  const [runId, setRunId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<AgentRunResponse | null>(null);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = snapshot?.run.status ?? null;
  const terminal = status === "completed" || status === "failed" || status === "cancelled";

  useEffect(() => {
    if (!runId || terminal) return;
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      try {
        const response = await fetch(`/api/agent/runs/${runId}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error ?? "Could not refresh the run.");
        setSnapshot(data);
        if (!["completed", "failed", "cancelled"].includes(data.run.status)) {
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
  }, [runId, terminal]);

  async function launch() {
    if (!repository || task.trim().length < 10 || launching) return;
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
          acceptanceCriteria: ["Implement the requested behavior", "Run relevant verification"],
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Could not start the agent.");
      setRunId(data.run.id);
      setSnapshot({
        run: data.run,
        steps: [],
        artifacts: [],
        tokens: {
          baselineTokens: 0,
          totalTokens: 0,
          savedTokens: 0,
          savedPct: 0,
        },
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start the agent.");
    } finally {
      setLaunching(false);
    }
  }

  const canLaunch = Boolean(repository) && task.trim().length >= 10;
  const diff = snapshot?.artifacts.find((artifact) => artifact.kind === "diff");
  const summary = snapshot?.artifacts.find((artifact) => artifact.kind === "summary");

  return (
    <section className="overflow-hidden rounded-[22px] border border-line-strong bg-surface">
      <div className="border-b border-line px-5 py-4">
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
              Agent run
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-[-0.025em] text-paper">
              Turn the Slice into a verified change.
            </h2>
          </div>
          <span className="rounded-full border border-line-strong px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
            approval gated
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
                ["Estimate", `−${estimatedSavedPct}%`],
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
              <span>{launching ? "Starting durable run…" : "Run task with Locus"}</span>
              <span aria-hidden>→</span>
            </button>
            <p className="mt-3 text-[11px] leading-5 text-muted">
              Executes in an isolated sandbox. GitHub delivery remains blocked until you approve it.
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
                {snapshot.tokens.savedPct}% saved
              </span>
            </div>
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

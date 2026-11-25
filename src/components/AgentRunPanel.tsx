"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { secondaryButton } from "@/components/controls";
import { ProposalPatch } from "@/components/ProposalPatch";
import { ProposalReview } from "@/components/ProposalReview";
import { RunContextLedger } from "@/components/RunContextLedger";
import { CONTROLLED_ALPHA_DATA_POLICY_VERSION } from "@/lib/agent/data-policy";
import { isActiveRun, isTerminalRun, type RunStatus } from "@/lib/agent/run-state";
import type { AgentRunSnapshot, AgentStepView } from "@/lib/agent/run-view";
import { runAccessCopy, type RunAccess } from "@/lib/run-access";

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
          const reviewReady = status === "awaiting_approval" && phase.statuses.includes(status);
          const complete = active > index || status === "completed" || reviewReady;
          const current = active === index && status !== "completed" && !reviewReady;
          return (
            <li key={phase.label} className="min-w-0" aria-current={current ? "step" : undefined}>
              <div className={`h-1 ${complete ? "bg-passed" : current ? "bg-ink" : "bg-excluded"}`} />
              <p className={`mt-2 truncate font-mono text-[11px] uppercase tracking-[0.08em] ${
                current ? "text-ink" : complete ? "text-ink-2" : "text-muted"
              }`}>
                {phase.label}
              </p>
              {/* Its own line, so a narrow phase never truncates the word that matters. */}
              {current && <p className="truncate font-mono text-[11px] text-muted">Working</p>}
            </li>
          );
        })}
      </ol>
      <ol className="mt-5 border-t border-line">
        {steps.map((step) => (
          <li
            key={step.id}
            className="flex items-center justify-between gap-3 border-b border-line py-2.5"
          >
            <span className="text-[14px] text-ink">{step.title}</span>
            <span className={`shrink-0 font-mono text-[11px] uppercase tracking-[0.08em] ${
              step.status === "failed" ? "text-failed" : step.status === "completed" ? "text-passed" : step.status === "running" ? "text-ink" : "text-muted"
            }`}>
              {step.status === "running" ? "Working" : step.status}
            </span>
          </li>
        ))}
      </ol>
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
  runAccess,
}: {
  repository: string | null;
  task: string;
  sliceCount: number;
  excludedCount: number;
  initialRunId?: string | null;
  acceptanceCriteria: string[];
  runAccess: RunAccess;
}) {
  // Declared before the effects, because the BYOK capacity probe from the
  // free-beta branch depends on it and only runs for an account that can start
  // a Run at all.
  const canStartRun = runAccess.canStart;
  const [runId, setRunId] = useState<string | null>(initialRunId);
  const [snapshot, setSnapshot] = useState<AgentRunSnapshot | null>(null);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataPolicyAccepted, setDataPolicyAccepted] = useState(false);
  const [executionMode, setExecutionMode] = useState<"shared" | "byok">("shared");
  const [byokConfigured, setByokConfigured] = useState<boolean | null>(null);
  const status = snapshot?.run.status ?? null;
  const shouldPoll = Boolean(runId) && (!status || isActiveRun(status));

  useEffect(() => {
    if (!canStartRun) return;
    const controller = new AbortController();
    void fetch("/api/provider-credential", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error();
        setByokConfigured(Boolean(payload.configured));
      })
      .catch(() => {
        if (!controller.signal.aborted) setByokConfigured(false);
      });
    return () => controller.abort();
  }, [canStartRun]);

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
    if (
      !runAccess.canStart
      || !repository
      || task.trim().length < 10
      || !dataPolicyAccepted
      || launching
    ) return;
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
          executionMode,
          acceptanceCriteria,
          dataPolicyAcceptance: {
            version: CONTROLLED_ALPHA_DATA_POLICY_VERSION,
          },
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
        reviews: [],
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

  async function refreshRun() {
    if (!runId) return;
    const response = await fetch(`/api/agent/runs/${runId}`, { cache: "no-store" });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) throw new Error(data?.error ?? "Could not refresh the Run.");
    setSnapshot(data);
  }

  // A finished Run otherwise holds the panel until the page is reloaded without
  // its id. The task stays as it was, so a rejected or failed attempt can be
  // reworded and started again.
  function startAnother() {
    setRunId(null);
    setSnapshot(null);
    setError(null);
    setDataPolicyAccepted(false);
    const url = new URL(window.location.href);
    url.searchParams.delete("run");
    window.history.replaceState(null, "", url);
  }

  const accessCopy = runAccessCopy(runAccess);
  // The allowance can be spent while the capability is still held. Without this
  // the panel kept asking which capacity to use and to accept a data policy —
  // inputs for a Run that cannot start. runAccessCopy already knew; the markup
  // did not, so it invited configuration for an action it was refusing.
  const allowanceSpent = runAccess.canStart
    && runAccess.usage !== null
    && runAccess.usage.runsInLast24Hours >= runAccess.quota.maxRunsPerRolling24Hours;
  const canConfigureRun = canStartRun && !allowanceSpent;
  const canLaunch = canStartRun
    && Boolean(repository)
    && task.trim().length >= 10
    && acceptanceCriteria.length > 0
    && dataPolicyAccepted
    && (executionMode === "shared" || byokConfigured === true);
  const diff = snapshot?.artifacts.find((artifact) => artifact.kind === "diff");
  const summary = snapshot?.artifacts.find((artifact) => artifact.kind === "summary");
  const pullRequest = snapshot?.artifacts.find((artifact) => artifact.kind === "pull_request");
  const review = snapshot?.reviews[0];
  const repositoryTruncated = snapshot?.steps.some(
    (step) => step.detail.repositoryTruncated === true,
  ) ?? false;

  return (
    <section className="overflow-hidden rounded-card border border-line-2 bg-surface">
      <div className="border-b border-line px-6 py-5">
        <div className="flex flex-wrap-reverse items-start justify-between gap-x-5 gap-y-3">
          <div className="min-w-0">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
              Agent Run
            </p>
            <h2 className="mt-2 font-display text-[28px] font-normal leading-tight tracking-[-0.015em] text-ink">
              Turn the Slice into a review-ready proposal.
            </h2>
          </div>
          <span className="shrink-0 whitespace-nowrap rounded-chip border border-line-2 px-2 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
            external writes off
          </span>
        </div>
      </div>

      <div className="p-6">
        {!snapshot ? (
          <>
            <dl className="grid grid-cols-3 border-y border-line">
              {[
                ["In the Slice", sliceCount, "text-included-ink"],
                ["Left out", excludedCount, "text-ink"],
                ["Repo", sliceCount + excludedCount, "text-ink"],
              ].map(([label, value, tone], index) => (
                <div key={label} className={`flex flex-col-reverse justify-end py-4 ${index > 0 ? "border-l border-line pl-4" : "pr-4"}`}>
                  <dt className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted">{label}</dt>
                  <dd className={`font-display text-[30px] leading-none tracking-[-0.02em] tabular-nums ${tone}`}>
                    {Number(value).toLocaleString("en-US")} <span className="font-sans text-[13px] tracking-normal text-muted">{value === 1 ? "file" : "files"}</span>
                  </dd>
                </div>
              ))}
            </dl>
            {canConfigureRun && (
              <fieldset className="mt-4 rounded-card border border-line p-3">
                <legend className="px-1 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                  Choose capacity
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className={`cursor-pointer rounded-chip border p-3 transition ${
                    executionMode === "shared" ? "border-ink bg-surface" : "border-line"
                  }`}>
                    <span className="flex items-center gap-2 text-[13px] font-medium text-ink">
                      <input
                        type="radio"
                        name="execution-mode"
                        value="shared"
                        checked={executionMode === "shared"}
                        onChange={() => setExecutionMode("shared")}
                        className="accent-[var(--included)]"
                      />
                      Use the shared beta Run
                    </span>
                    <span className="mt-1 block pl-5 text-[12px] leading-5 text-muted">
                      Free. One substantial Run per UTC day across Locus. Availability is confirmed when you start.
                    </span>
                  </label>
                  <label className={`cursor-pointer rounded-chip border p-3 transition ${
                    executionMode === "byok" ? "border-ink bg-surface" : "border-line"
                  }`}>
                    <span className="flex items-center gap-2 text-[13px] font-medium text-ink">
                      <input
                        type="radio"
                        name="execution-mode"
                        value="byok"
                        checked={executionMode === "byok"}
                        onChange={() => setExecutionMode("byok")}
                        className="accent-[var(--included)]"
                      />
                      Use my Cloudflare account
                    </span>
                    <span className="mt-1 block pl-5 text-[12px] leading-5 text-muted">
                      {byokConfigured
                        ? "Connected. This Run uses capacity from your account."
                        : "Not connected yet. Setup takes about two minutes."}
                    </span>
                  </label>
                </div>
                {executionMode === "byok" && byokConfigured !== true && (
                  <Link href="/settings" className="mt-3 inline-block text-[12px] font-medium text-ink underline decoration-line-2 underline-offset-4 transition-colors hover:decoration-ink">
                    Connect Cloudflare in Settings →
                  </Link>
                )}
              </fieldset>
            )}
            {canConfigureRun && (
              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-card border border-line px-3 py-3 text-[12px] leading-5 text-ink-2">
                <input
                  type="checkbox"
                  checked={dataPolicyAccepted}
                  onChange={(event) => setDataPolicyAccepted(event.target.checked)}
                  className="mt-1 size-3.5 shrink-0 accent-[var(--included)]"
                />
                <span>
                  I confirm this public Repo, task, and criteria contain no private,
                  confidential, or personal data. Run content is processed by Cloudflare
                  Workers AI under its customer-data policy.
                </span>
              </label>
            )}
            {allowanceSpent ? (
              <p className="mt-4 flex w-full items-center justify-between rounded-chip border border-line-2 px-4 py-3.5 text-[14px] font-medium text-muted">
                <span>{accessCopy.action}</span>
              </p>
            ) : !canStartRun && accessCopy.href ? (
              // A refused account gets a control that actually goes somewhere.
              // Rendering "Request access" on a disabled button was a dead end
              // wearing the costume of a next step.
              <a
                href={accessCopy.href}
                className="mt-4 flex w-full items-center justify-between rounded-chip border border-line-2 px-4 py-3.5 text-[14px] font-medium text-ink transition hover:border-ink/40 hover:text-ink"
              >
                <span>{accessCopy.action}</span>
                <span aria-hidden>→</span>
              </a>
            ) : (
              <button
                type="button"
                onClick={launch}
                disabled={!canLaunch || launching}
                className="mt-4 flex w-full items-center justify-between rounded-chip bg-ink px-4 py-3.5 text-[14px] font-medium text-canvas transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span>{launching ? "Starting durable run…" : accessCopy.action}</span>
                <span aria-hidden>→</span>
              </button>
            )}
            <p className="mt-3 text-[12px] leading-5 text-muted">
              {accessCopy.explanation}
            </p>
          </>
        ) : (
          <>
            <AgentRunTimeline status={snapshot.run.status} steps={snapshot.steps} />
            <div className="mt-5 flex items-center justify-between rounded-card bg-canvas px-3 py-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
                {snapshot.run.status.replaceAll("_", " ")}
              </span>
              <span className="font-mono text-[12px] font-medium text-included-ink">
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
                className="mt-4 rounded-card border border-failed/40 bg-failed/10 px-3 py-3 text-[13px] leading-5 text-failed"
              >
                The repository scan reached the early-access file cap. Some files are outside both
                the included and excluded lists; review the diff carefully or start a narrower run.
              </p>
            )}
            {summary?.content && <p className="mt-4 text-[14px] leading-6 text-ink-2">{summary.content}</p>}
            {diff?.content && (
              <details className="mt-4 rounded-card border border-line">
                <summary className="cursor-pointer px-3 py-3 text-[13px] font-medium text-ink">
                  Review proposed diff
                </summary>
                <pre className="max-h-80 overflow-auto border-t border-line p-3 font-mono text-[11px] leading-5 text-ink-2" tabIndex={0}>
                  {diff.content}
                </pre>
              </details>
            )}
            <div className="mt-4 empty:hidden">
              <ProposalPatch key={snapshot.run.id} snapshot={snapshot} />
            </div>
            {snapshot.run.status === "awaiting_approval" && snapshot.run.proposal_hash && snapshot.task && (
              <div className="mt-4">
                <ProposalReview
                  key={snapshot.run.proposal_hash}
                  runId={snapshot.run.id}
                  proposalHash={snapshot.run.proposal_hash}
                  acceptanceCriteria={snapshot.task.acceptance_criteria}
                  onDecided={refreshRun}
                />
              </div>
            )}
            {review && (
              <p className="mt-4 rounded-card border border-line-2 bg-canvas px-4 py-3 text-[13px] leading-5 text-ink-2">
                Proposal {review.decision} with criterion-level review evidence.
              </p>
            )}
            {pullRequest?.url && (
              <a
                href={pullRequest.url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 flex w-full items-center justify-between rounded-chip bg-ink px-4 py-3.5 text-[14px] font-medium text-canvas"
              >
                <span>{pullRequest.label}</span>
                <span aria-hidden>↗</span>
              </a>
            )}
            {snapshot.run.error && (
              <p role="alert" className="mt-4 text-[13px] leading-5 text-failed">{snapshot.run.error}</p>
            )}
            {isTerminalRun(snapshot.run.status) && (
              <button type="button" onClick={startAnother} className={`mt-4 ${secondaryButton}`}>
                Start another Run
              </button>
            )}
          </>
        )}
        {error && <p role="alert" className="mt-3 text-[13px] text-failed">{error}</p>}
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";

import { dangerButton, primaryButton } from "@/components/controls";
import { InlineError } from "@/components/EmptyState";
import {
  reviewDecisionAvailability,
  type AgentCriterionDecision,
} from "@/lib/agent/run-review";

/** What the owner decided, said once the decision is saved. */
export function ReviewOutcome({ decision }: { decision: string }) {
  if (decision !== "accepted" && decision !== "rejected") return null;
  return (
    <p role="status" className="rounded-card border border-line-2 bg-canvas px-4 py-3 text-[14px] leading-6 text-ink-2">
      {decision === "accepted"
        ? "You approved this change. Download it below to use it in your own copy of the Repo."
        : "You rejected this change. Edit the task and start a new Run to try again."}
    </p>
  );
}

/**
 * The criterion-by-criterion Review of one Review-ready proposal. Rendered
 * wherever its evidence is shown. Give it the proposal hash as its key, so
 * another proposal never inherits this one's ticks.
 */
export function ProposalReview({
  runId,
  proposalHash,
  acceptanceCriteria,
  onDecided,
}: {
  runId: string;
  proposalHash: string;
  acceptanceCriteria: readonly string[];
  onDecided: () => Promise<void>;
}) {
  const [criteria, setCriteria] = useState<AgentCriterionDecision[]>(
    () => acceptanceCriteria.map((criterion) => ({ criterion, satisfied: false })),
  );
  const [pending, setPending] = useState<"accepted" | "rejected" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const availability = reviewDecisionAvailability(criteria);

  function update(index: number, change: Partial<AgentCriterionDecision>) {
    setCriteria((current) => current.map((item, position) => (
      position === index ? { ...item, ...change } : item
    )));
  }

  async function decide(decision: "accepted" | "rejected") {
    if (pending || !(decision === "accepted" ? availability.canAccept : availability.canReject)) return;
    setPending(decision);
    setError(null);
    try {
      const response = await fetch(`/api/agent/runs/${runId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalHash, decision, criteria }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Could not save your decision.");
      await onDecided();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save your decision.");
    } finally {
      setPending(null);
    }
  }

  const remaining = criteria.filter((criterion) => !criterion.satisfied).length;
  const goalWord = (count: number) => (count === 1 ? "goal" : "goals");

  return (
    <fieldset className="min-w-0 rounded-card border border-line-2 bg-canvas p-4">
      <legend className="px-1 text-[15px] font-medium text-ink">Did the agent do what you asked?</legend>
      <p className="mt-1 text-[13px] leading-5 text-ink-2">
        Read the code change above, then tick each goal it meets. Approve when every goal is met,
        or reject it if something is wrong.
      </p>
      <ul className="mt-3 space-y-3">
        {criteria.map((criterion, index) => (
          <li key={criterion.criterion} className="rounded-chip border border-line px-3 py-2.5">
            <label className="flex items-start gap-2 text-[14px] leading-5 text-ink">
              <input
                type="checkbox"
                checked={criterion.satisfied}
                onChange={(event) => update(index, { satisfied: event.target.checked })}
                className="mt-0.5 size-4 shrink-0 accent-[var(--included)]"
              />
              <span className="min-w-0 [overflow-wrap:anywhere]">{criterion.criterion}</span>
            </label>
            <input
              type="text"
              value={criterion.evidence ?? ""}
              onChange={(event) => update(index, { evidence: event.target.value })}
              maxLength={2_000}
              aria-label={`Note for ${criterion.criterion}`}
              placeholder="Optional note"
              className="mt-2 w-full rounded-chip border border-line bg-surface px-2.5 py-2 text-[13px] text-ink placeholder:text-muted"
            />
          </li>
        ))}
      </ul>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => decide("rejected")}
          disabled={!availability.canReject || pending !== null}
          className={dangerButton}
        >
          {pending === "rejected" ? "Saving…" : "Reject change"}
        </button>
        <button
          type="button"
          onClick={() => decide("accepted")}
          disabled={!availability.canAccept || pending !== null}
          aria-describedby={remaining > 0 ? `${runId}-approve-hint` : undefined}
          className={primaryButton}
        >
          {pending === "accepted" ? "Saving…" : "Approve change"}
        </button>
      </div>
      <p id={`${runId}-approve-hint`} className="mt-3 text-[12px] leading-5 text-muted" aria-live="polite">
        {remaining > 0
          ? criteria.length === 1
            ? "Tick the goal to approve."
            : remaining === criteria.length
              ? "Tick every goal to approve."
              : `Tick the ${remaining} remaining ${goalWord(remaining)} to approve.`
          : "Approving marks this Run done and keeps the change for you to download."}
        {" "}Nothing is sent to GitHub either way.
      </p>
      {error && <InlineError className="mt-3">{error}</InlineError>}
    </fieldset>
  );
}

"use client";

import { useState } from "react";

import { dangerButton, primaryButton } from "@/components/controls";
import { InlineError } from "@/components/EmptyState";
import {
  reviewDecisionAvailability,
  type AgentCriterionDecision,
} from "@/lib/agent/run-review";

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
      if (!response.ok) throw new Error(data?.error ?? "Could not record the review.");
      await onDecided();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not record the review.");
    } finally {
      setPending(null);
    }
  }

  return (
    <fieldset className="rounded-card border border-line-2 bg-canvas p-4">
      <legend className="px-1 text-[13px] font-medium text-ink">Review frozen acceptance criteria</legend>
      <p className="mt-1 break-all font-mono text-[11px] text-muted">Proposal {proposalHash}</p>
      <div className="mt-3 space-y-3">
        {criteria.map((criterion, index) => (
          <div key={criterion.criterion} className="rounded-chip border border-line px-3 py-2.5">
            <label className="flex items-start gap-2 text-[13px] leading-5 text-ink-2">
              <input
                type="checkbox"
                checked={criterion.satisfied}
                onChange={(event) => update(index, { satisfied: event.target.checked })}
                className="mt-1 size-3.5 accent-[var(--included)]"
              />
              <span>{criterion.criterion}</span>
            </label>
            <input
              type="text"
              value={criterion.evidence ?? ""}
              onChange={(event) => update(index, { evidence: event.target.value })}
              maxLength={2_000}
              aria-label={`Evidence for ${criterion.criterion}`}
              placeholder="Evidence or reason"
              className="mt-2 w-full rounded-chip border border-line bg-surface px-2.5 py-2 text-[13px] text-ink placeholder:text-muted"
            />
          </div>
        ))}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => decide("rejected")}
          disabled={!availability.canReject || pending !== null}
          className={dangerButton}
        >
          {pending === "rejected" ? "Recording…" : "Reject proposal"}
        </button>
        <button
          type="button"
          onClick={() => decide("accepted")}
          disabled={!availability.canAccept || pending !== null}
          className={primaryButton}
        >
          {pending === "accepted" ? "Recording…" : "Accept criteria"}
        </button>
      </div>
      <p className="mt-3 text-[12px] leading-5 text-muted">
        The decision is bound to this immutable proposal. External GitHub writes remain off.
      </p>
      {error && <InlineError className="mt-3">{error}</InlineError>}
    </fieldset>
  );
}

import type { RunQuota } from "@/lib/admission";

export type QuotaReason = "active" | "daily";

// Retry-after policy lives here rather than in SQL. `claim_agent_run_slot`
// enforces the invariant and reports which limit was hit; what to tell the user
// about it is an application decision, and keeping it in one place stops the
// advisory pre-check and the authoritative claim from answering differently.
const RETRY_AFTER_SECONDS: Record<QuotaReason, number> = {
  active: 60,
  daily: 3_600,
};

// The message states the limit the account actually has. The previous wording
// hard-coded "Two agent runs", which was true only for the invited-partner
// allowance and became wrong for three of the four tiers the moment quota
// started varying. A refusal that misstates the limit teaches the user the wrong
// thing about the product they are being asked to pay for.
export function quotaDenialMessage(reason: QuotaReason, quota: RunQuota): string {
  if (reason === "active") {
    return quota.maxActiveRuns === 1
      ? "An agent run is already active. Wait for it to finish."
      : `${quota.maxActiveRuns} agent runs are already active. Wait for one to finish.`;
  }
  return `Daily Agent Run quota reached (${quota.maxDailyRuns}). Try again tomorrow.`;
}


export function isQuotaReason(value: unknown): value is QuotaReason {
  return value === "active" || value === "daily";
}

export function quotaRetryAfterSeconds(reason: QuotaReason): number {
  return RETRY_AFTER_SECONDS[reason];
}

/**
 * Advisory pre-check only.
 *
 * The limits arrive as an argument rather than as module constants. Quota is the
 * cost control and it now varies by Tier, so a single pair of globals could only
 * ever be right for one kind of account — and would silently be wrong for the
 * rest.
 *
 * This reads counts and decides, so by the time a caller acts on the answer it
 * may be stale — that gap is exactly the race that let concurrent requests each
 * see the same pre-insert counts and all pass. The authority is
 * `claim_agent_run_slot`, which counts and inserts in one transaction under a
 * per-user lock. This is kept because it rejects the common case before a task
 * row is created, and because a clear refusal is cheaper than a claim round trip.
 */
export function agentRunQuotaDecision(input: {
  activeRuns: number;
  dailyRuns: number;
  quota: RunQuota;
}):
  | { allowed: true }
  | { allowed: false; reason: QuotaReason; retryAfterSeconds: number } {
  if (input.activeRuns >= input.quota.maxActiveRuns) {
    return { allowed: false, reason: "active", retryAfterSeconds: RETRY_AFTER_SECONDS.active };
  }
  if (input.dailyRuns >= input.quota.maxDailyRuns) {
    return { allowed: false, reason: "daily", retryAfterSeconds: RETRY_AFTER_SECONDS.daily };
  }
  return { allowed: true };
}

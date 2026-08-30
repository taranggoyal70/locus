export const MAX_ACTIVE_RUNS = 2;
export const MAX_DAILY_RUNS = 10;

export type QuotaReason = "active" | "daily";

// Retry-after policy lives here rather than in SQL. `claim_agent_run_slot`
// enforces the invariant and reports which limit was hit; what to tell the user
// about it is an application decision, and keeping it in one place stops the
// advisory pre-check and the authoritative claim from answering differently.
const RETRY_AFTER_SECONDS: Record<QuotaReason, number> = {
  active: 60,
  daily: 3_600,
};

const DENIAL_MESSAGES: Record<QuotaReason, string> = {
  active: "Two agent runs are already active. Wait for one to finish.",
  daily: "Early-access daily Agent Run quota reached. Try again tomorrow.",
};

export function isQuotaReason(value: unknown): value is QuotaReason {
  return value === "active" || value === "daily";
}

export function quotaRetryAfterSeconds(reason: QuotaReason): number {
  return RETRY_AFTER_SECONDS[reason];
}

export function quotaDenialMessage(reason: QuotaReason): string {
  return DENIAL_MESSAGES[reason];
}

/**
 * Advisory pre-check only.
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
}):
  | { allowed: true }
  | { allowed: false; reason: QuotaReason; retryAfterSeconds: number } {
  if (input.activeRuns >= MAX_ACTIVE_RUNS) {
    return { allowed: false, reason: "active", retryAfterSeconds: RETRY_AFTER_SECONDS.active };
  }
  if (input.dailyRuns >= MAX_DAILY_RUNS) {
    return { allowed: false, reason: "daily", retryAfterSeconds: RETRY_AFTER_SECONDS.daily };
  }
  return { allowed: true };
}

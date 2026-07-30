const MAX_ACTIVE_RUNS = 2;
const MAX_DAILY_RUNS = 10;

export function agentRunQuotaDecision(input: {
  activeRuns: number;
  dailyRuns: number;
}):
  | { allowed: true }
  | { allowed: false; reason: "active" | "daily"; retryAfterSeconds: number } {
  if (input.activeRuns >= MAX_ACTIVE_RUNS) {
    return { allowed: false, reason: "active", retryAfterSeconds: 60 };
  }
  if (input.dailyRuns >= MAX_DAILY_RUNS) {
    return { allowed: false, reason: "daily", retryAfterSeconds: 3_600 };
  }
  return { allowed: true };
}

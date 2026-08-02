export const RUN_STATUSES = [
  "queued",
  "localizing",
  "planning",
  "executing",
  "verifying",
  "awaiting_approval",
  "completed",
  "failed",
  "cancelled",
] as const;

export type RunStatus = (typeof RUN_STATUSES)[number];

const TERMINAL_STATUSES = new Set<RunStatus>(["completed", "failed", "cancelled"]);

const FORWARD_TRANSITIONS: Record<RunStatus, readonly RunStatus[]> = {
  queued: ["localizing"],
  localizing: ["planning"],
  planning: ["executing"],
  executing: ["verifying"],
  verifying: ["awaiting_approval"],
  awaiting_approval: ["completed"],
  completed: [],
  failed: [],
  cancelled: [],
};

export function isRunStatus(value: string): value is RunStatus {
  return RUN_STATUSES.includes(value as RunStatus);
}

export function isTerminalRun(status: RunStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function canTransitionRun(current: RunStatus, next: RunStatus): boolean {
  if (isTerminalRun(current)) return false;
  if (next === "failed" || next === "cancelled") return true;
  return FORWARD_TRANSITIONS[current].includes(next);
}

export function assertRunTransition(current: RunStatus, next: RunStatus): void {
  if (!canTransitionRun(current, next)) {
    throw new Error(`Invalid Run transition: ${current} → ${next}`);
  }
}

export type RunTokenLedger = {
  baselineTokens: number;
  includedContextTokens: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
  contextTokensSaved: number;
  contextReductionPercent: number;
};

export type RunSavingsClaim =
  | {
      verified: true;
      savedTokens: number;
      savedPct: number;
    }
  | {
      verified: false;
      savedTokens: null;
      savedPct: null;
    };

export function savingsClaimForRun(
  status: RunStatus,
  ledger: Pick<RunTokenLedger, "contextTokensSaved" | "contextReductionPercent">,
): RunSavingsClaim {
  if (status !== "completed") {
    return { verified: false, savedTokens: null, savedPct: null };
  }
  return {
    verified: true,
    savedTokens: ledger.contextTokensSaved,
    savedPct: ledger.contextReductionPercent,
  };
}

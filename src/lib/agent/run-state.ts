export const RUN_STATUSES = [
  "queued",
  "localizing",
  "planning",
  "executing",
  "verifying",
  "awaiting_approval",
  "completed",
  "rejected",
  "failed",
  "cancelled",
] as const;

export type RunStatus = (typeof RUN_STATUSES)[number];

const TERMINAL_STATUSES = new Set<RunStatus>(["completed", "rejected", "failed", "cancelled"]);
export const ACTIVE_RUN_STATUSES: readonly RunStatus[] = [
  "queued",
  "localizing",
  "planning",
  "executing",
  "verifying",
];
const ACTIVE_STATUSES = new Set<RunStatus>(ACTIVE_RUN_STATUSES);

const FORWARD_TRANSITIONS: Record<RunStatus, readonly RunStatus[]> = {
  queued: ["localizing"],
  localizing: ["planning"],
  planning: ["executing"],
  executing: ["verifying"],
  verifying: ["awaiting_approval"],
  awaiting_approval: ["completed", "rejected"],
  completed: [],
  rejected: [],
  failed: [],
  cancelled: [],
};

export function isRunStatus(value: string): value is RunStatus {
  return RUN_STATUSES.includes(value as RunStatus);
}

export function isTerminalRun(status: RunStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function isActiveRun(status: RunStatus): boolean {
  return ACTIVE_STATUSES.has(status);
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
  ledger: Pick<RunTokenLedger, "totalTokens">,
  outcome?: {
    acceptanceCriteriaSatisfied: boolean;
    pairedWholeRepoBaseline: {
      acceptanceCriteriaSatisfied: boolean;
      totalTokens: number;
    };
  },
): RunSavingsClaim {
  const baseline = outcome?.pairedWholeRepoBaseline;
  if (
    status !== "completed"
    || !outcome?.acceptanceCriteriaSatisfied
    || !baseline?.acceptanceCriteriaSatisfied
    || baseline.totalTokens <= 0
    || ledger.totalTokens >= baseline.totalTokens
  ) {
    return { verified: false, savedTokens: null, savedPct: null };
  }
  const savedTokens = baseline.totalTokens - ledger.totalTokens;
  return {
    verified: true,
    savedTokens,
    savedPct: Math.round((savedTokens / baseline.totalTokens) * 100),
  };
}

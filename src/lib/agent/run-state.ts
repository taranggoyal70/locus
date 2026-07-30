export type AgentRunStatus =
  | "queued"
  | "localizing"
  | "planning"
  | "executing"
  | "verifying"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "cancelled";

export type AgentRunEvent =
  | "start"
  | "localized"
  | "planned"
  | "code_changed"
  | "verified"
  | "approved"
  | "fail"
  | "cancel";

const TRANSITIONS: Partial<Record<AgentRunStatus, Partial<Record<AgentRunEvent, AgentRunStatus>>>> = {
  queued: { start: "localizing", fail: "failed", cancel: "cancelled" },
  localizing: { localized: "planning", fail: "failed", cancel: "cancelled" },
  planning: { planned: "executing", fail: "failed", cancel: "cancelled" },
  executing: { code_changed: "verifying", fail: "failed", cancel: "cancelled" },
  verifying: {
    verified: "awaiting_approval",
    code_changed: "executing",
    fail: "failed",
    cancel: "cancelled",
  },
  awaiting_approval: { approved: "completed", fail: "failed", cancel: "cancelled" },
};

export function transitionRun(status: AgentRunStatus, event: AgentRunEvent): AgentRunStatus {
  const next = TRANSITIONS[status]?.[event];
  if (!next) throw new Error(`Cannot apply ${event} while run is ${status}`);
  return next;
}

export type TokenUsageInput = {
  baselineTokens: number;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
};

export type TokenUsageSummary = TokenUsageInput & {
  totalTokens: number;
  savedTokens: number;
  savedPct: number;
};

function safeInteger(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

export function summarizeTokenUsage(usage: TokenUsageInput): TokenUsageSummary {
  const baselineTokens = safeInteger(usage.baselineTokens);
  const inputTokens = safeInteger(usage.inputTokens);
  const outputTokens = safeInteger(usage.outputTokens);
  const cachedInputTokens = Math.min(inputTokens, safeInteger(usage.cachedInputTokens));
  const totalTokens = inputTokens + outputTokens;
  const savedTokens = Math.max(0, baselineTokens - totalTokens);
  const savedPct = baselineTokens > 0
    ? Math.round((savedTokens / baselineTokens) * 100)
    : 0;

  return {
    baselineTokens,
    inputTokens,
    outputTokens,
    cachedInputTokens,
    totalTokens,
    savedTokens,
    savedPct,
  };
}

const DEFAULT_RUN_TOKEN_BUDGET = 180_000;
const MIN_RUN_TOKEN_BUDGET = 10_000;
const MAX_RUN_TOKEN_BUDGET = 240_000;
const MIN_FINAL_OUTPUT_TOKENS = 1_000;

export type AgentFailureKind =
  | "quota_exhausted"
  | "token_budget_exhausted"
  | "provider_error"
  | "sandbox_error"
  | "verification_error"
  | "workflow_error";

export class RunBudgetExceededError extends Error {
  readonly budgetTokens: number;
  readonly consumedTokens: number;

  constructor(budgetTokens: number, consumedTokens: number) {
    super(`Run token budget exhausted (${consumedTokens}/${budgetTokens} tokens).`);
    this.name = "RunBudgetExceededError";
    this.budgetTokens = budgetTokens;
    this.consumedTokens = consumedTokens;
  }
}

export function resolveRunTokenBudget(
  environment: { LOCUS_RUN_TOKEN_BUDGET?: string } = {
    LOCUS_RUN_TOKEN_BUDGET: process.env["LOCUS_RUN_TOKEN_BUDGET"],
  },
): number {
  const configured = environment.LOCUS_RUN_TOKEN_BUDGET?.trim();
  if (!configured) return DEFAULT_RUN_TOKEN_BUDGET;
  if (!/^\d+$/.test(configured)) {
    throw new Error("LOCUS_RUN_TOKEN_BUDGET must be an integer.");
  }
  const budget = Number(configured);
  if (budget < MIN_RUN_TOKEN_BUDGET || budget > MAX_RUN_TOKEN_BUDGET) {
    throw new Error(
      `LOCUS_RUN_TOKEN_BUDGET must be between ${MIN_RUN_TOKEN_BUDGET} and ${MAX_RUN_TOKEN_BUDGET}.`,
    );
  }
  return budget;
}

export function estimateSerializedTokens(value: unknown): number {
  const serialized = JSON.stringify(value);
  return Math.max(1, Math.ceil((serialized?.length ?? 0) / 4));
}

export function nextStepBudgetDecision(input: {
  budgetTokens: number;
  consumedTokens: number;
  estimatedInputTokens: number;
  requestedOutputTokens: number;
}): { allowed: true; maxOutputTokens: number; remainingTokens: number } {
  const consumedTokens = Math.max(0, Math.round(input.consumedTokens));
  const remainingTokens = Math.max(
    0,
    Math.round(input.budgetTokens) - consumedTokens - Math.max(0, Math.round(input.estimatedInputTokens)),
  );
  if (remainingTokens < MIN_FINAL_OUTPUT_TOKENS) {
    throw new RunBudgetExceededError(input.budgetTokens, consumedTokens);
  }
  return {
    allowed: true,
    maxOutputTokens: Math.min(Math.max(MIN_FINAL_OUTPUT_TOKENS, input.requestedOutputTokens), remainingTokens),
    remainingTokens,
  };
}

export function assertWithinRunTokenBudget(input: {
  budgetTokens: number;
  inputTokens: number | undefined;
  outputTokens: number | undefined;
}): void {
  const consumedTokens = Math.max(0, input.inputTokens ?? 0)
    + Math.max(0, input.outputTokens ?? 0);
  if (consumedTokens > input.budgetTokens) {
    throw new RunBudgetExceededError(input.budgetTokens, consumedTokens);
  }
}

function failureText(error: unknown): string {
  if (!(error instanceof Error)) return String(error).toLowerCase();
  const cause = "cause" in error ? failureText(error.cause) : "";
  return `${error.name} ${error.message} ${cause}`.toLowerCase();
}

export function classifyAgentFailure(error: unknown): AgentFailureKind {
  if (error instanceof RunBudgetExceededError) return "token_budget_exhausted";
  const text = failureText(error);
  if (
    /\b429\b|resource_exhausted|quota(?: limit)? (?:exceeded|exhausted)|rate limit/.test(text)
  ) {
    return "quota_exhausted";
  }
  if (/verification failed|approved verification command/.test(text)) {
    return "verification_error";
  }
  if (/sandbox|workspace stopped|workspace provisioning/.test(text)) {
    return "sandbox_error";
  }
  if (
    /provider|language model|ai_apicallerror|model response|codingagenttimeouterror|coding agent execution exceeded its deadline/.test(
      text,
    )
  ) {
    return "provider_error";
  }
  return "workflow_error";
}

export function agentFailureMessage(kind: AgentFailureKind): string {
  const messages: Record<AgentFailureKind, string> = {
    quota_exhausted:
      "The model provider quota is temporarily exhausted. The Run stopped safely; retry after the provider window resets.",
    token_budget_exhausted:
      "The Run reached its token budget before it could produce a review-ready proposal. Narrow the task or Slice before retrying.",
    provider_error:
      "The model provider could not complete this Run. No proposal was published.",
    sandbox_error:
      "The isolated workspace could not complete this Run. No proposal was published.",
    verification_error:
      "One or more required checks failed. Review the Run evidence before retrying.",
    workflow_error:
      "The durable workflow could not complete this Run. No proposal was published.",
  };
  return messages[kind];
}

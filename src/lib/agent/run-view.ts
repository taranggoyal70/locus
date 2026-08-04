import type { AgentFailureKind } from "@/lib/agent/run-budget";
import type { AgentCriterionDecision } from "@/lib/agent/run-review";
import type { RunStatus } from "@/lib/agent/run-state";

type ControlledAlphaLedger = {
  baselineContextTokens: number;
  includedContextTokens: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
};

export function controlledAlphaTokenView(ledger: ControlledAlphaLedger) {
  return {
    baselineTokens: ledger.baselineContextTokens,
    includedContextTokens: ledger.includedContextTokens,
    inputTokens: ledger.inputTokens,
    cachedInputTokens: ledger.cachedInputTokens,
    outputTokens: ledger.outputTokens,
    totalTokens: ledger.totalTokens,
  };
}

export type AgentStepView = {
  id: number;
  sequence: number;
  title: string;
  status: string;
  detail: Record<string, unknown>;
};

export type AgentArtifactView = {
  id: string;
  kind: string;
  label: string;
  content: string | null;
  url: string | null;
  content_sha256?: string | null;
  base_revision?: string | null;
};

export type AgentReviewView = {
  id: string;
  proposal_hash: string;
  decision: "accepted" | "rejected";
  criterion_decisions: AgentCriterionDecision[];
  note: string | null;
  created_at: string;
};

export type AgentTaskView = {
  id: string;
  repo_url: string;
  base_ref: string;
  task: string;
  acceptance_criteria: string[];
};

export type AgentRunSnapshot = {
  run: {
    id: string;
    status: RunStatus;
    error: string | null;
    failure_kind: AgentFailureKind | null;
    proposal_hash: string | null;
    token_budget: number;
    included_files: string[];
    excluded_files: string[];
    widened_files: string[];
    created_at?: string;
  };
  task?: AgentTaskView;
  steps: AgentStepView[];
  artifacts: AgentArtifactView[];
  reviews: AgentReviewView[];
  tokens: {
    baselineTokens: number;
    includedContextTokens: number;
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
};

export type AgentRunSummary = {
  id: string;
  status: RunStatus;
  created_at: string;
  updated_at: string;
  included_files: string[];
  excluded_files: string[];
  widened_files: string[];
  error: string | null;
  task: AgentTaskView | null;
  tokens: {
    totalTokens: number;
    cachedInputTokens: number;
  };
};

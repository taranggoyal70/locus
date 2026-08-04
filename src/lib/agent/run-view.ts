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
    included_files: string[];
    excluded_files: string[];
    widened_files: string[];
    created_at?: string;
  };
  task?: AgentTaskView;
  steps: AgentStepView[];
  artifacts: AgentArtifactView[];
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

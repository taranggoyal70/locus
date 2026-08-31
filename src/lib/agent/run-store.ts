import type { Database, Json } from "@/lib/database.types";
import type { AgentFailureKind } from "@/lib/agent/run-budget";
import type { AgentCriterionDecision } from "@/lib/agent/run-review";
import {
  assertRunTransition,
  isRunStatus,
  isTerminalRun,
  type RunStatus,
} from "@/lib/agent/run-state";
import { serviceClient } from "@/lib/supabase";

type RunUpdate = Database["public"]["Tables"]["agent_runs"]["Update"];

export async function transitionRun(input: {
  runId: string;
  userId: string;
  current: RunStatus;
  next: RunStatus;
  values?: Omit<RunUpdate, "status">;
}): Promise<void> {
  assertRunTransition(input.current, input.next);
  const db = serviceClient();
  const { data, error } = await db
    .from("agent_runs")
    .update({ ...input.values, status: input.next })
    .eq("id", input.runId)
    .eq("user_id", input.userId)
    .eq("status", input.current)
    .select("id")
    .single();
  if (!error && data) return;

  // Durable Workflow can replay a step after the database update committed but
  // before the step result was acknowledged. Treat that exact replay as
  // success while preserving the compare-and-swap guard for every other state.
  const { data: currentRun, error: currentError } = await db
    .from("agent_runs")
    .select("status")
    .eq("id", input.runId)
    .eq("user_id", input.userId)
    .single();
  if (!currentError && currentRun?.status === input.next) return;

  throw new Error(`Run could not transition from ${input.current} to ${input.next}`);
}

export async function patchRun(input: {
  runId: string;
  userId: string;
  current: RunStatus;
  values: Omit<RunUpdate, "status">;
}): Promise<void> {
  if (isTerminalRun(input.current)) throw new Error("Terminal Runs cannot be rewritten");
  const db = serviceClient();
  const { data, error } = await db
    .from("agent_runs")
    .update(input.values)
    .eq("id", input.runId)
    .eq("user_id", input.userId)
    .eq("status", input.current)
    .select("id")
    .single();
  if (error || !data) throw new Error(`Run is no longer ${input.current}`);
}

export async function appendRunStep(input: {
  runId: string;
  userId: string;
  sequence: number;
  kind: "localize" | "plan" | "tool" | "widen" | "verify" | "approval" | "delivery";
  status: "completed" | "failed" | "skipped";
  title: string;
  detail?: Json;
  inputTokens?: number;
  outputTokens?: number;
}): Promise<void> {
  const db = serviceClient();
  const { error } = await db.from("agent_steps").insert({
    run_id: input.runId,
    user_id: input.userId,
    sequence: input.sequence,
    kind: input.kind,
    status: input.status,
    title: input.title,
    detail: input.detail ?? {},
    input_tokens: input.inputTokens ?? 0,
    output_tokens: input.outputTokens ?? 0,
    completed_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Could not append Run Step: ${error.message}`);
}

export async function publishRunProposal(input: {
  runId: string;
  userId: string;
  baseRevision: string;
  changeSetContent: string;
  diff: string;
  summary: string;
  toolDetail: Json;
  verifyDetail: Json;
  includedContextTokens: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  widenedFiles: string[];
  excludedFiles: string[];
}): Promise<string> {
  const db = serviceClient();
  const { data, error } = await db.rpc("publish_agent_proposal", {
    p_run_id: input.runId,
    p_user_id: input.userId,
    p_base_revision: input.baseRevision,
    p_change_set: input.changeSetContent,
    p_diff: input.diff,
    p_summary: input.summary,
    p_tool_detail: input.toolDetail,
    p_verify_detail: input.verifyDetail,
    p_included_context_tokens: input.includedContextTokens,
    p_input_tokens: input.inputTokens,
    p_cached_input_tokens: input.cachedInputTokens,
    p_output_tokens: input.outputTokens,
    p_widened_files: input.widenedFiles,
    p_excluded_files: input.excludedFiles,
  });
  const proposalHash = data?.[0]?.proposal_hash;
  if (error || !proposalHash) {
    throw new Error(`Could not atomically publish Agent proposal: ${error?.message ?? "missing hash"}`);
  }
  return proposalHash;
}

export async function releaseRunProviderLease(runId: string): Promise<void> {
  const db = serviceClient();
  const { error } = await db.rpc("release_agent_provider_lease", {
    p_run_id: runId,
    p_cooldown_seconds: 60,
  });
  if (error) throw new Error(`Could not release provider capacity: ${error.message}`);
}

export async function decideRunProposal(input: {
  runId: string;
  userId: string;
  proposalHash: string;
  decision: "accepted" | "rejected";
  criteria: AgentCriterionDecision[];
  note: string | null;
}): Promise<{ status: "completed" | "rejected"; reviewId: string }> {
  const db = serviceClient();
  const { data, error } = await db.rpc("decide_agent_proposal", {
    p_run_id: input.runId,
    p_user_id: input.userId,
    p_proposal_hash: input.proposalHash,
    p_decision: input.decision,
    p_criterion_decisions: input.criteria,
    p_note: input.note,
  });
  const result = data?.[0];
  if (
    error
    || !result
    || (result.run_status !== "completed" && result.run_status !== "rejected")
  ) {
    throw new Error("Run proposal decision could not be recorded");
  }
  return { status: result.run_status, reviewId: result.review_id };
}

export async function failRun(
  runId: string,
  message: string,
  failureKind: AgentFailureKind = "workflow_error",
): Promise<void> {
  const db = serviceClient();
  const { data: run, error } = await db
    .from("agent_runs")
    .select("user_id,status")
    .eq("id", runId)
    .single();
  if (error || !run || !isRunStatus(run.status)) return;
  if (isTerminalRun(run.status)) return;
  await transitionRun({
    runId,
    userId: run.user_id,
    current: run.status,
    next: "failed",
    values: {
      error: message.slice(0, 2_000),
      failure_kind: failureKind,
      completed_at: new Date().toISOString(),
    },
  });
}

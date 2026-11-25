import type { Updateable } from "kysely";

import type { AgentFailureKind } from "@/lib/agent/run-budget";
import type { AgentCriterionDecision } from "@/lib/agent/run-review";
import {
  assertRunTransition,
  isRunStatus,
  isTerminalRun,
  type RunStatus,
} from "@/lib/agent/run-state";
import type { WidenAttempt } from "@/lib/agent/workspace-tools";
import { globalDb, rpc, tenantDb, type Json } from "@/lib/db";
import { jsonb } from "@/lib/db/json";
import type { AgentRunsTable } from "@/lib/db/schema";

type RunUpdate = Updateable<AgentRunsTable>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function transitionRun(input: {
  runId: string;
  userId: string;
  current: RunStatus;
  next: RunStatus;
  values?: Omit<RunUpdate, "status">;
}): Promise<void> {
  assertRunTransition(input.current, input.next);
  const db = tenantDb(input.userId);
  let cause: unknown;
  try {
    const updated = await db
      .updateTable("agent_runs")
      .set({ ...input.values, status: input.next })
      .where("id", "=", input.runId)
      .where("user_id", "=", input.userId)
      .where("status", "=", input.current)
      .returning("id")
      .executeTakeFirst();
    if (updated) return;
  } catch (error) {
    cause = error;
  }

  // Durable Workflow can replay a step after the database update committed but
  // before the step result was acknowledged. Treat that exact replay as
  // success while preserving the compare-and-swap guard for every other state.
  try {
    const currentRun = await db
      .selectFrom("agent_runs")
      .select("status")
      .where("id", "=", input.runId)
      .where("user_id", "=", input.userId)
      .executeTakeFirst();
    if (!isTerminalRun(input.next) && currentRun?.status === input.next) return;
  } catch (error) {
    cause ??= error;
  }

  throw new Error(`Run could not transition from ${input.current} to ${input.next}`, { cause });
}

export async function patchRun(input: {
  runId: string;
  userId: string;
  current: RunStatus;
  values: Omit<RunUpdate, "status">;
}): Promise<void> {
  if (isTerminalRun(input.current)) throw new Error("Terminal Runs cannot be rewritten");
  let updated: { id: string } | undefined;
  try {
    updated = await tenantDb(input.userId)
      .updateTable("agent_runs")
      .set(input.values)
      .where("id", "=", input.runId)
      .where("user_id", "=", input.userId)
      .where("status", "=", input.current)
      .returning("id")
      .executeTakeFirst();
  } catch (error) {
    throw new Error(`Run is no longer ${input.current}`, { cause: error });
  }
  if (!updated) throw new Error(`Run is no longer ${input.current}`);
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
  try {
    await tenantDb(input.userId).insertInto("agent_steps").values({
      run_id: input.runId,
      user_id: input.userId,
      sequence: input.sequence,
      kind: input.kind,
      status: input.status,
      title: input.title,
      detail: jsonb(input.detail ?? {}),
      input_tokens: input.inputTokens ?? 0,
      output_tokens: input.outputTokens ?? 0,
      completed_at: new Date().toISOString(),
    }).execute();
  } catch (error) {
    throw new Error(`Could not append Run Step: ${errorMessage(error)}`, { cause: error });
  }
}

/**
 * R15: persist the Widen attempt trail, grants and refusals alike.
 *
 * Written as its own rows rather than folded into the proposal blob because the
 * questions it answers are per-attempt and ordered: what did this Run ask for,
 * in what order, and what was it refused? A single array serialized at the end
 * of a Run cannot answer either.
 *
 * Rows are immutable once written (see migration 021), so this is called once
 * per Run with the complete trail. An empty trail writes nothing.
 */
export async function recordWidenAttempts(input: {
  runId: string;
  userId: string;
  attempts: WidenAttempt[];
}): Promise<void> {
  if (input.attempts.length === 0) return;
  try {
    await tenantDb(input.userId).insertInto("agent_widen_events").values(
      input.attempts.map((attempt) => ({
        run_id: input.runId,
        user_id: input.userId,
        sequence: attempt.sequence,
        path: attempt.path.slice(0, 1000),
        reason: attempt.reason.slice(0, 2000),
        outcome: attempt.outcome,
        refusal: attempt.refusal,
        detail: attempt.detail ? attempt.detail.slice(0, 2000) : null,
      })),
    ).execute();
  } catch (error) {
    throw new Error(`Could not record Widen attempts: ${errorMessage(error)}`, { cause: error });
  }
}

/**
 * Keep what a Run made but could not publish, so a failed check does not cost the
 * person the work. These artifacts carry no content hash and the Run has no
 * proposal hash, so nothing can be Reviewed, downloaded as a patch, or delivered
 * from them, and they expire with the Run.
 */
export async function recordUnpublishedChange(input: {
  runId: string;
  userId: string;
  baseRevision: string;
  diff: string;
  checks: ReadonlyArray<{ command: string; exitCode: number; output: string }>;
}): Promise<void> {
  await tenantDb(input.userId).transaction().execute(async (transaction) => {
    const run = await transaction
      .selectFrom("agent_runs")
      .select("status")
      .where("id", "=", input.runId)
      .where("user_id", "=", input.userId)
      .forUpdate()
      .executeTakeFirst();
    // A cancelled Run was discarded on purpose.
    if (run?.status !== "executing") return;
    await transaction.insertInto("agent_artifacts").values([
      {
        run_id: input.runId,
        user_id: input.userId,
        kind: "diff",
        label: "Unpublished change",
        content: input.diff,
        base_revision: input.baseRevision,
      },
      ...(input.checks.length === 0 ? [] : [{
        run_id: input.runId,
        user_id: input.userId,
        kind: "test" as const,
        label: "Check output",
        content: input.checks
          .map((check) => `${check.command}\n${check.output}`)
          .join("\n\n"),
        base_revision: input.baseRevision,
      }]),
    ]).execute();
  });
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
  let rows: { proposal_hash: string | null }[] = [];
  let failure: unknown;
  try {
    rows = await rpc(tenantDb(input.userId), "publish_agent_proposal", {
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
  } catch (error) {
    failure = error;
  }
  const proposalHash = rows[0]?.proposal_hash;
  if (failure || !proposalHash) {
    throw new Error(
      `Could not atomically publish Agent proposal: ${failure ? errorMessage(failure) : "missing hash"}`,
      { cause: failure },
    );
  }
  return proposalHash;
}

export async function releaseRunProviderLease(runId: string): Promise<void> {
  try {
    // Provider capacity is shared by every account; the lease is keyed by Run.
    await rpc(globalDb("provider capacity leases span accounts"), "release_agent_provider_lease", {
      p_run_id: runId,
      p_cooldown_seconds: 60,
    });
  } catch (error) {
    throw new Error(`Could not release provider capacity: ${errorMessage(error)}`, { cause: error });
  }
}

export async function decideRunProposal(input: {
  runId: string;
  userId: string;
  proposalHash: string;
  decision: "accepted" | "rejected";
  criteria: AgentCriterionDecision[];
  note: string | null;
}): Promise<{ status: "completed" | "rejected"; reviewId: string }> {
  let result: { run_status: string | null; review_id: string | null } | undefined;
  try {
    [result] = await rpc(tenantDb(input.userId), "decide_agent_proposal", {
      p_run_id: input.runId,
      p_user_id: input.userId,
      p_proposal_hash: input.proposalHash,
      p_decision: input.decision,
      p_criterion_decisions: input.criteria as unknown as Json,
      p_note: input.note,
    });
  } catch (error) {
    throw new Error("Run proposal decision could not be recorded", { cause: error });
  }
  if (
    !result
    || !result.review_id
    || (result.run_status !== "completed" && result.run_status !== "rejected")
  ) {
    throw new Error("Run proposal decision could not be recorded");
  }
  return { status: result.run_status, reviewId: result.review_id };
}

/**
 * Give back the shared daily slot of a Run that never called the model. Claims
 * otherwise survive failure so retries cannot multiply provider spend; a Run
 * stopped earlier spent none, and there is one slot a day for everyone. The
 * account's own rolling Run quota still counts it, which bounds repeats.
 */
export async function releaseUnusedDailyClaim(runId: string): Promise<void> {
  await globalDb("provider daily claims span accounts")
    .deleteFrom("agent_provider_daily_claims")
    .where("run_id", "=", runId)
    .where((where) => where.exists(
      where.selectFrom("agent_runs")
        .select("agent_runs.id")
        .whereRef("agent_runs.id", "=", "agent_provider_daily_claims.run_id")
        .where("agent_runs.status", "in", ["failed", "cancelled"])
        .where("agent_runs.input_tokens", "=", 0)
        .where("agent_runs.output_tokens", "=", 0),
    ))
    .execute();
}

export async function failRun(
  runId: string,
  message: string,
  failureKind: AgentFailureKind = "workflow_error",
): Promise<void> {
  let run: { user_id: string; status: string } | undefined;
  try {
    // Called from workflow failure handlers that hold only the Run id; this
    // lookup is how the owner is found.
    run = await globalDb("failing a Run resolves its owner from the Run id")
      .selectFrom("agent_runs")
      .select(["user_id", "status"])
      .where("id", "=", runId)
      .executeTakeFirst();
  } catch {
    return;
  }
  if (!run || !isRunStatus(run.status)) return;
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

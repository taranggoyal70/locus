import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { start } from "workflow/api";

import { calculateTokenLedger, resolveAgentModel } from "@/lib/agent/coding-agent";
import { resolveRunTokenBudget } from "@/lib/agent/run-budget";
import {
  agentRunQuotaDecision,
  isQuotaReason,
  quotaDenialMessage,
  quotaRetryAfterSeconds,
  MAX_ACTIVE_RUNS,
  MAX_DAILY_RUNS,
} from "@/lib/agent/run-quota";
import { parseAgentRunRequest } from "@/lib/agent/run-request";
import { ACTIVE_RUN_STATUSES } from "@/lib/agent/run-state";
import {
  appendRunStep,
  releaseRunProviderLease,
  transitionRun,
} from "@/lib/agent/run-store";
import { controlledAlphaTokenView } from "@/lib/agent/run-view";
import { alphaCapabilitiesForUser } from "@/lib/alpha-capabilities";
import { logger } from "@/lib/logger";
import { consumeRateLimit } from "@/lib/rate-limit";
import { readLimitedJson, sameOriginMutation } from "@/lib/request-security";
import { tenantClient } from "@/lib/supabase-tenant";
import { agentRunWorkflow } from "@/workflows/agent-run";

const MAX_BODY_BYTES = 12_000;

async function releaseProviderCapacity(runId: string) {
  try {
    await releaseRunProviderLease(runId);
  } catch {
    logger.error("agent.provider_lease.release_failed", {}, runId);
  }
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const db = tenantClient(userId);
  const { data, error } = await db
    .from("agent_runs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) {
    return NextResponse.json({ error: "Could not load agent runs." }, { status: 500 });
  }
  const taskIds = [...new Set(data.map((run) => run.task_id))];
  const { data: tasks, error: taskError } = taskIds.length > 0
    ? await db
      .from("agent_tasks")
      .select("id,repo_url,base_ref,task,acceptance_criteria")
      .eq("user_id", userId)
      .in("id", taskIds)
    : { data: [], error: null };
  if (taskError) {
    return NextResponse.json({ error: "Could not load Agent Tasks." }, { status: 500 });
  }
  const tasksById = new Map((tasks ?? []).map((task) => [task.id, task]));
  const runs = data.map((run) => {
    const ledger = calculateTokenLedger({
      baselineContextTokens: run.baseline_tokens,
      includedContextTokens: run.included_context_tokens,
      inputTokens: run.input_tokens,
      cachedInputTokens: run.cached_input_tokens,
      outputTokens: run.output_tokens,
    });
    const tokenView = controlledAlphaTokenView(ledger);
    return {
      ...run,
      task: tasksById.get(run.task_id) ?? null,
      tokens: {
        totalTokens: tokenView.totalTokens,
        cachedInputTokens: tokenView.cachedInputTokens,
      },
    };
  });
  return NextResponse.json({ runs });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!alphaCapabilitiesForUser(userId).runStart) {
    return NextResponse.json(
      { error: "Agent Runs are limited to invited design partners during the controlled alpha." },
      { status: 403 },
    );
  }
  if (!sameOriginMutation(request)) {
    return NextResponse.json({ error: "Cross-site requests are not allowed." }, { status: 403 });
  }
  let input;
  try {
    const parsed = await readLimitedJson(request, MAX_BODY_BYTES);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    input = parseAgentRunRequest(parsed.value);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid agent run request." },
      { status: 400 },
    );
  }

  let model: string;
  let tokenBudget: number;
  try {
    model = resolveAgentModel();
    tokenBudget = resolveRunTokenBudget();
  } catch {
    return NextResponse.json(
      { error: "Agent Run deployment limits are not configured safely." },
      { status: 503 },
    );
  }

  let startRate;
  try {
    startRate = await consumeRateLimit({
      namespace: "agent-run-start",
      identity: userId,
      limit: 3,
      windowSeconds: 60,
    });
  } catch {
    return NextResponse.json(
      { error: "Agent Run limits could not be verified. Try again shortly." },
      { status: 503 },
    );
  }
  if (!startRate.allowed) {
    return NextResponse.json(
      { error: "Too many agent starts. Wait a minute and try again." },
      { status: 429, headers: { "Retry-After": String(startRate.retryAfterSeconds) } },
    );
  }
  const db = tenantClient(userId);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1_000).toISOString();
  const [activeResult, dailyResult] = await Promise.all([
    db
      .from("agent_runs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", [...ACTIVE_RUN_STATUSES]),
    db
      .from("agent_runs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", oneDayAgo),
  ]);
  if (activeResult.error || dailyResult.error) {
    return NextResponse.json({ error: "Could not verify agent run quota." }, { status: 503 });
  }
  const quota = agentRunQuotaDecision({
    activeRuns: activeResult.count ?? 0,
    dailyRuns: dailyResult.count ?? 0,
  });
  if (!quota.allowed) {
    return NextResponse.json(
      { error: quotaDenialMessage(quota.reason) },
      { status: 429, headers: { "Retry-After": String(quota.retryAfterSeconds) } },
    );
  }

  const { data: task, error: taskError } = await db
    .from("agent_tasks")
    .insert({
      user_id: userId,
      repo_url: input.repository,
      base_ref: input.baseRef,
      task: input.task,
      acceptance_criteria: input.acceptanceCriteria,
    })
    .select("id")
    .single();
  if (taskError || !task) {
    return NextResponse.json(
      { error: "Agent runs are not available yet. Check the database rollout." },
      { status: 503 },
    );
  }

  // R12: the quota check above is advisory. Counting and inserting must happen in
  // one transaction or concurrent requests all read the same pre-insert counts and
  // all pass — measured at six concurrent requests creating six Runs against a
  // limit of two. `claim_agent_run_slot` holds a per-user advisory lock across
  // both, so this is the decision that actually binds.
  const { data: claimData, error: claimError } = await db.rpc("claim_agent_run_slot", {
    p_user_id: userId,
    p_task_id: task.id,
    p_model: model,
    p_token_budget: tokenBudget,
    p_active_statuses: [...ACTIVE_RUN_STATUSES],
    p_max_active: MAX_ACTIVE_RUNS,
    p_max_daily: MAX_DAILY_RUNS,
  });
  const claim = claimData?.[0];
  if (claimError || !claim) {
    // The task was created in anticipation of a Run that will not exist, so it is
    // removed rather than left as an orphan no flow will ever reach.
    await db.from("agent_tasks").delete().eq("id", task.id).eq("user_id", userId);
    return NextResponse.json({ error: "Could not create the agent run." }, { status: 503 });
  }
  if (!claim.allowed) {
    await db.from("agent_tasks").delete().eq("id", task.id).eq("user_id", userId);
    const reason = isQuotaReason(claim.reason) ? claim.reason : "active";
    return NextResponse.json(
      { error: quotaDenialMessage(reason) },
      { status: 429, headers: { "Retry-After": String(quotaRetryAfterSeconds(reason)) } },
    );
  }

  // An allowed claim always carries the inserted id. Checked rather than asserted
  // so a future change to the function cannot turn this into a silent lookup of
  // every Run.
  if (!claim.run_id) {
    return NextResponse.json({ error: "Could not create the agent run." }, { status: 500 });
  }

  const { data: run, error: runError } = await db
    .from("agent_runs")
    .select("*")
    .eq("id", claim.run_id)
    .eq("user_id", userId)
    .single();
  if (runError || !run) {
    return NextResponse.json({ error: "Could not create the agent run." }, { status: 500 });
  }

  const { data: leaseData, error: leaseError } = await db.rpc(
    "acquire_agent_provider_lease",
    {
      p_run_id: run.id,
      p_model: model,
      p_max_concurrent: 1,
      p_lease_seconds: 3_600,
    },
  );
  const lease = leaseData?.[0];
  if (leaseError || !lease) {
    await transitionRun({
      runId: run.id,
      userId,
      current: "queued",
      next: "failed",
      values: {
        error: "Provider capacity could not be reserved.",
        failure_kind: "workflow_error",
        completed_at: new Date().toISOString(),
      },
    });
    return NextResponse.json(
      { error: "Agent provider capacity could not be verified." },
      { status: 503 },
    );
  }
  if (!lease.allowed) {
    await transitionRun({
      runId: run.id,
      userId,
      current: "queued",
      next: "failed",
      values: {
        error: "Another Agent Run is using the free-tier provider capacity.",
        failure_kind: "quota_exhausted",
        completed_at: new Date().toISOString(),
      },
    });
    return NextResponse.json(
      { error: "Agent capacity is busy. Retry after the current provider window." },
      {
        status: 429,
        headers: { "Retry-After": String(lease.retry_after_seconds) },
      },
    );
  }

  const policyAcceptedAt = new Date().toISOString();
  try {
    await appendRunStep({
      runId: run.id,
      userId,
      sequence: 0,
      kind: "approval",
      status: "completed",
      title: "Controlled-alpha data policy accepted",
      detail: {
        policyVersion: input.dataPolicyVersion,
        acceptedAt: policyAcceptedAt,
      },
    });
  } catch {
    await releaseProviderCapacity(run.id);
    await transitionRun({
      runId: run.id,
      userId,
      current: "queued",
      next: "failed",
      values: {
        error: "The data-policy acceptance could not be recorded.",
        completed_at: new Date().toISOString(),
      },
    });
    return NextResponse.json(
      { error: "The Agent Run data policy could not be recorded." },
      { status: 503 },
    );
  }

  let workflowRun;
  try {
    // R10: pin the Run to the deployment that started it.
    //
    // "latest" meant a Run begun before a deploy could resume its remaining
    // steps on newly deployed code. The steps are the security policy: path
    // containment, the network lock, the sensitive-path classes, and the
    // candidate integrity check all live in them. A Run that localizes under
    // one policy and publishes under another has no single policy at all, and
    // the proposal hash would attest to a mixture.
    //
    // Falls back to "latest" only where no deployment id exists, which is local
    // development, where there is one version of the code by definition.
    workflowRun = await start(agentRunWorkflow, [{ runId: run.id }], {
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? "latest",
    });
  } catch {
    await releaseProviderCapacity(run.id);
    await transitionRun({
      runId: run.id,
      userId,
      current: "queued",
      next: "failed",
      values: {
        error: "The durable workflow could not be started.",
        completed_at: new Date().toISOString(),
      },
    });
    return NextResponse.json(
      { error: "The agent run was created, but execution could not start.", runId: run.id },
      { status: 503 },
    );
  }

  const { error: updateError } = await db
    .from("agent_runs")
    .update({ workflow_run_id: workflowRun.runId })
    .eq("id", run.id)
    .eq("user_id", userId);
  if (updateError) {
    logger.error("agent.workflow.correlation_failed", {}, run.id);
  }

  return NextResponse.json(
    {
      run: { ...run, workflow_run_id: updateError ? null : workflowRun.runId },
      statusUrl: `/api/agent/runs/${run.id}`,
    },
    { status: 202 },
  );
}

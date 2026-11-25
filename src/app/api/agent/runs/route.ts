import { auth } from "@clerk/nextjs/server";
import { sql } from "kysely";
import { NextResponse } from "next/server";
import { start } from "workflow/api";

import { calculateTokenLedger, resolveAgentModel } from "@/lib/agent/coding-agent";
import { cloudflareCredentialStatus } from "@/lib/agent/provider-credential-store";
import {
  CLOUDFLARE_PROVIDER,
  isDeploymentOwner,
  providerCapacityKey,
  resolveSharedDailyRunLimit,
  sharedCloudflareConfigured,
  SHARED_RUN_TOKEN_BUDGET,
  SHARED_RUNS_PER_PERSON_PER_DAY,
} from "@/lib/agent/provider-config";
import { resolveRunTokenBudget } from "@/lib/agent/run-budget";
import {
  agentRunQuotaDecision,
  quotaReasonFromClaim,
  quotaDenialMessage,
  quotaRetryAfterSeconds,
} from "@/lib/agent/run-quota";
import { parseAgentRunRequest } from "@/lib/agent/run-request";
import { readRunUsage } from "@/lib/agent/run-usage";
import { ACTIVE_RUN_STATUSES } from "@/lib/agent/run-state";
import {
  appendRunStep,
  releaseRunProviderLease,
  transitionRun,
} from "@/lib/agent/run-store";
import { controlledAlphaTokenView } from "@/lib/agent/run-view";
import { admissionForAccount } from "@/lib/admission-server";
import { runStartRefusal } from "@/lib/admission-copy";
import { track } from "@/lib/analytics";
import { globalDb, rpc, tenantDb } from "@/lib/db";
import { logger } from "@/lib/logger";
import { consumeRateLimit } from "@/lib/rate-limit";
import { readLimitedJson, sameOriginMutation } from "@/lib/request-security";
import { agentRunWorkflow } from "@/workflows/agent-run";

const MAX_BODY_BYTES = 12_000;

function secondsUntilUtcMidnight(now = new Date()): number {
  const reset = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(1, Math.ceil((reset - now.getTime()) / 1_000));
}

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

  const db = tenantDb(userId);
  let data;
  try {
    data = await db
      .selectFrom("agent_runs")
      .selectAll()
      .where("user_id", "=", userId)
      .orderBy("created_at", "desc")
      .limit(20)
      .execute();
  } catch {
    return NextResponse.json({ error: "Could not load agent runs." }, { status: 500 });
  }
  const taskIds = [...new Set(data.map((run) => run.task_id))];
  let tasks: { id: string; repo_url: string; base_ref: string; task: string; acceptance_criteria: string[] }[] = [];
  if (taskIds.length > 0) {
    try {
      tasks = await db
        .selectFrom("agent_tasks")
        .select(["id", "repo_url", "base_ref", "task", "acceptance_criteria"])
        .where("user_id", "=", userId)
        .where("id", "in", taskIds)
        .execute();
    } catch {
      return NextResponse.json({ error: "Could not load Agent Tasks." }, { status: 500 });
    }
  }
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
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
  // The Admission is resolved once and carried through the whole request. Every
  // later decision - the advisory pre-check, the authoritative claim - reads the
  // quota from this one object, so a Run cannot be admitted under one tier's
  // limits and counted against another's.
  const admission = await admissionForAccount(userId);
  if (!admission.capabilities.runStart) {
    return NextResponse.json(
      {
        error: runStartRefusal(admission.reason),
      },
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
  let sharedDailyLimit: number;
  try {
    model = resolveAgentModel();
    tokenBudget = resolveRunTokenBudget();
    sharedDailyLimit = resolveSharedDailyRunLimit();
    if (input.executionMode === "shared") {
      tokenBudget = Math.min(tokenBudget, SHARED_RUN_TOKEN_BUDGET);
    }
  } catch {
    return NextResponse.json(
      { error: "Agent Run deployment limits are not configured safely." },
      { status: 503 },
    );
  }

  if (input.executionMode === "shared" && !sharedCloudflareConfigured()) {
    return NextResponse.json(
      { error: "Shared Agent Run capacity is not configured." },
      { status: 503 },
    );
  }
  if (input.executionMode === "byok") {
    try {
      const credential = await cloudflareCredentialStatus(userId);
      if (!credential.configured) {
        return NextResponse.json(
          { error: "Connect your Cloudflare Workers AI account in Settings first." },
          { status: 409 },
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Your Cloudflare connection could not be verified." },
        { status: 503 },
      );
    }
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
  const db = tenantDb(userId);
  let usage;
  try {
    usage = await readRunUsage(userId);
  } catch {
    return NextResponse.json({ error: "Could not verify agent run quota." }, { status: 503 });
  }
  const quota = agentRunQuotaDecision({
    activeRuns: usage.activeRuns,
    runsInLast24Hours: usage.runsInLast24Hours,
    quota: admission.runQuota,
  });
  if (!quota.allowed) {
    return NextResponse.json(
      { error: quotaDenialMessage(quota.reason, admission.runQuota) },
      { status: 429, headers: { "Retry-After": String(quota.retryAfterSeconds) } },
    );
  }

  const task = await db
    .insertInto("agent_tasks")
    .values({
      user_id: userId,
      repo_url: input.repository,
      base_ref: input.baseRef,
      task: input.task,
      acceptance_criteria: input.acceptanceCriteria,
    })
    .returning("id")
    .executeTakeFirst()
    .catch(() => undefined);
  if (!task) {
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
  // The task was created in anticipation of a Run; when no Run follows, it is
  // removed rather than left as an orphan no flow will ever reach. Best effort,
  // as before: the refusal is the answer the caller needs.
  const removeTask = () => db
    .deleteFrom("agent_tasks")
    .where("id", "=", task.id)
    .where("user_id", "=", userId)
    .execute()
    .catch(() => undefined);

  const claim = await rpc(db, "claim_agent_run_slot", {
    p_user_id: userId,
    p_task_id: task.id,
    p_model: model,
    p_token_budget: tokenBudget,
    p_active_statuses: [...ACTIVE_RUN_STATUSES],
    // Tier quota from Admission, provider route from the free-beta branch. The
    // two are independent: Admission decides how many Runs this account may
    // hold, the provider columns record which engine executed them.
    p_max_active: admission.runQuota.maxActiveRuns,
    // The SQL function predates the clarified product name. Its `p_max_daily`
    // argument enforces the same rolling `now() - interval '24 hours'` window.
    p_max_daily: admission.runQuota.maxRunsPerRolling24Hours,
    p_provider: CLOUDFLARE_PROVIDER,
    p_execution_mode: input.executionMode,
  }).then((rows) => rows[0], () => undefined);
  if (!claim) {
    await removeTask();
    return NextResponse.json({ error: "Could not create the agent run." }, { status: 503 });
  }
  if (!claim.allowed) {
    await removeTask();
    const reason = quotaReasonFromClaim(claim.reason) ?? "active";
    return NextResponse.json(
      { error: quotaDenialMessage(reason, admission.runQuota) },
      { status: 429, headers: { "Retry-After": String(quotaRetryAfterSeconds(reason)) } },
    );
  }

  // An allowed claim always carries the inserted id. Checked rather than asserted
  // so a future change to the function cannot turn this into a silent lookup of
  // every Run.
  if (!claim.run_id) {
    return NextResponse.json({ error: "Could not create the agent run." }, { status: 500 });
  }

  const run = await db
    .selectFrom("agent_runs")
    .selectAll()
    .where("id", "=", claim.run_id)
    .where("user_id", "=", userId)
    .executeTakeFirst()
    .catch(() => undefined);
  if (!run) {
    return NextResponse.json({ error: "Could not create the agent run." }, { status: 500 });
  }

  // Provider capacity is shared across accounts; the lease is keyed by Run.
  const capacity = globalDb("provider capacity leases span accounts");
  const lease = await rpc(capacity, "acquire_agent_provider_lease", {
    p_run_id: run.id,
    p_model: providerCapacityKey({ executionMode: input.executionMode, userId }),
    p_max_concurrent: 1,
    p_lease_seconds: 3_600,
  }).then((rows) => rows[0], () => undefined);
  if (!lease) {
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

  // Owners are exempt from both daily limits so the operator can verify
  // production after the public has used the pool. Their Runs take no daily
  // claim, so they do not shrink what everyone else gets either.
  if (input.executionMode === "shared" && !isDeploymentOwner(userId)) {
    // One shared Run per person per UTC day. Read under the provider lease taken
    // above, which admits one shared Run at a time, so two starts by the same
    // person cannot both see zero. Claims for Runs that never called the model
    // are released, so a start that failed early does not use the person's Run.
    const personal = await capacity
      .selectFrom("agent_provider_daily_claims as claim")
      .innerJoin("agent_runs as run", "run.id", "claim.run_id")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where("claim.provider", "=", CLOUDFLARE_PROVIDER)
      .where("claim.usage_day", "=", sql<string>`(pg_catalog.now() at time zone 'UTC')::date`)
      .where("run.user_id", "=", userId)
      .where("claim.run_id", "!=", run.id)
      .executeTakeFirst()
      .then((row) => Number(row?.count ?? 0), () => undefined);
    if (personal === undefined) {
      await releaseProviderCapacity(run.id);
      await transitionRun({
        runId: run.id,
        userId,
        current: "queued",
        next: "failed",
        values: {
          error: "Shared daily capacity could not be verified.",
          failure_kind: "workflow_error",
          completed_at: new Date().toISOString(),
        },
      });
      return NextResponse.json(
        { error: "Shared Agent Run capacity could not be verified." },
        { status: 503 },
      );
    }
    if (personal >= SHARED_RUNS_PER_PERSON_PER_DAY) {
      await releaseProviderCapacity(run.id);
      await transitionRun({
        runId: run.id,
        userId,
        current: "queued",
        next: "failed",
        values: {
          error: "This account has already used today's shared Agent Run.",
          failure_kind: "quota_exhausted",
          completed_at: new Date().toISOString(),
        },
      });
      return NextResponse.json(
        { error: "You have used your shared Agent Run for today. Try again after the UTC reset or use your Cloudflare account." },
        {
          status: 429,
          headers: { "Retry-After": String(secondsUntilUtcMidnight()) },
        },
      );
    }

    const daily = await rpc(capacity, "claim_agent_provider_daily_slot", {
      p_run_id: run.id,
      p_provider: CLOUDFLARE_PROVIDER,
      p_max_daily: sharedDailyLimit,
    }).then((rows) => rows[0], () => undefined);
    if (!daily) {
      await releaseProviderCapacity(run.id);
      await transitionRun({
        runId: run.id,
        userId,
        current: "queued",
        next: "failed",
        values: {
          error: "Shared daily capacity could not be verified.",
          failure_kind: "workflow_error",
          completed_at: new Date().toISOString(),
        },
      });
      return NextResponse.json(
        { error: "Shared Agent Run capacity could not be verified." },
        { status: 503 },
      );
    }
    if (!daily.allowed) {
      await releaseProviderCapacity(run.id);
      await transitionRun({
        runId: run.id,
        userId,
        current: "queued",
        next: "failed",
        values: {
          error: "Today's shared Agent Run capacity has already been claimed.",
          failure_kind: "quota_exhausted",
          completed_at: new Date().toISOString(),
        },
      });
      return NextResponse.json(
        { error: "Today's shared Agent Runs are used. Try again after the UTC reset or use your Cloudflare account." },
        {
          status: 429,
          headers: { "Retry-After": String(daily.retry_after_seconds) },
        },
      );
    }
  }

  const policyAcceptedAt = new Date().toISOString();
  try {
    await appendRunStep({
      runId: run.id,
      userId,
      sequence: 0,
      kind: "approval",
      status: "completed",
      title: "Early-access data policy accepted",
      detail: {
        policyVersion: input.dataPolicyVersion,
        acceptedAt: policyAcceptedAt,
        provider: CLOUDFLARE_PROVIDER,
        executionMode: input.executionMode,
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

  const correlated = await db
    .updateTable("agent_runs")
    .set({ workflow_run_id: workflowRun.runId })
    .where("id", "=", run.id)
    .where("user_id", "=", userId)
    .execute()
    .then(() => true, () => false);
  if (!correlated) {
    logger.error("agent.workflow.correlation_failed", {}, run.id);
  }

  await track({
    event: "agent_run_started",
    userId,
    properties: { workflowCorrelated: correlated },
  });

  return NextResponse.json(
    {
      run: { ...run, workflow_run_id: correlated ? workflowRun.runId : null },
      statusUrl: `/api/agent/runs/${run.id}`,
    },
    { status: 202 },
  );
}

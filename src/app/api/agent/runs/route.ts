import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { start } from "workflow/api";

import { resolveAgentModel } from "@/lib/agent/coding-agent";
import { agentRunQuotaDecision } from "@/lib/agent/run-quota";
import { parseAgentRunRequest } from "@/lib/agent/run-request";
import { serviceClient } from "@/lib/supabase";
import { agentRunWorkflow } from "@/workflows/agent-run";

const MAX_BODY_BYTES = 12_000;
const startBursts = new Map<string, number[]>();

function allowStartBurst(userId: string): boolean {
  const cutoff = Date.now() - 60_000;
  const recent = (startBursts.get(userId) ?? []).filter((timestamp) => timestamp > cutoff);
  if (recent.length >= 3) return false;
  recent.push(Date.now());
  startBursts.set(userId, recent);
  if (startBursts.size > 10_000) {
    for (const [key, timestamps] of startBursts) {
      if (timestamps.every((timestamp) => timestamp <= cutoff)) startBursts.delete(key);
    }
  }
  return true;
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const db = serviceClient();
  const { data, error } = await db
    .from("agent_runs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) {
    return NextResponse.json({ error: "Could not load agent runs." }, { status: 500 });
  }
  return NextResponse.json({ runs: data });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "Cross-site requests are not allowed." }, { status: 403 });
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "Content-Type must be application/json." }, { status: 415 });
  }
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
  }

  let input;
  try {
    input = parseAgentRunRequest(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid agent run request." },
      { status: 400 },
    );
  }

  const db = serviceClient();
  if (!allowStartBurst(userId)) {
    return NextResponse.json(
      { error: "Too many agent starts. Wait a minute and try again." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1_000).toISOString();
  const [activeResult, dailyResult] = await Promise.all([
    db
      .from("agent_runs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", ["queued", "localizing", "planning", "executing", "verifying"]),
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
    const error = quota.reason === "active"
      ? "Two agent runs are already active. Wait for one to finish."
      : "Public-beta daily agent quota reached. Try again tomorrow.";
    return NextResponse.json(
      { error },
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

  const { data: run, error: runError } = await db
    .from("agent_runs")
    .insert({
      task_id: task.id,
      user_id: userId,
      model: resolveAgentModel(),
    })
    .select("*")
    .single();
  if (runError || !run) {
    return NextResponse.json({ error: "Could not create the agent run." }, { status: 500 });
  }

  try {
    const workflowRun = await start(agentRunWorkflow, [{ runId: run.id }], {
      deploymentId: "latest",
    });
    const { error: updateError } = await db
      .from("agent_runs")
      .update({ workflow_run_id: workflowRun.runId })
      .eq("id", run.id)
      .eq("user_id", userId);
    if (updateError) throw updateError;

    return NextResponse.json(
      {
        run: { ...run, workflow_run_id: workflowRun.runId },
        statusUrl: `/api/agent/runs/${run.id}`,
      },
      { status: 202 },
    );
  } catch {
    await db
      .from("agent_runs")
      .update({
        status: "failed",
        error: "The durable workflow could not be started.",
        completed_at: new Date().toISOString(),
      })
      .eq("id", run.id)
      .eq("user_id", userId);
    return NextResponse.json(
      { error: "The agent run was created, but execution could not start.", runId: run.id },
      { status: 503 },
    );
  }
}

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { start } from "workflow/api";

import { resolveAgentModel } from "@/lib/agent/coding-agent";
import { parseAgentRunRequest } from "@/lib/agent/run-request";
import { serviceClient } from "@/lib/supabase";
import { agentRunWorkflow } from "@/workflows/agent-run";

const MAX_BODY_BYTES = 12_000;

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

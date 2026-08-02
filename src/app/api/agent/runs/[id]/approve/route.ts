import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { createGitHubPullRequest } from "@/lib/agent/github-delivery";
import { appendRunStep, transitionRun } from "@/lib/agent/run-store";
import type { AgentChange } from "@/lib/agent/workspace";
import { serviceClient } from "@/lib/supabase";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "Cross-site requests are not allowed." }, { status: 403 });
  }

  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid run identifier." }, { status: 400 });
  }

  const db = serviceClient();
  const { data: run, error: runError } = await db
    .from("agent_runs")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .eq("status", "awaiting_approval")
    .single();
  if (runError || !run) {
    return NextResponse.json({ error: "This run is not awaiting approval." }, { status: 409 });
  }

  const [taskResult, changeSetResult, summaryResult, connectionResult] = await Promise.all([
    db.from("agent_tasks").select("*").eq("id", run.task_id).eq("user_id", userId).single(),
    db
      .from("agent_artifacts")
      .select("content")
      .eq("run_id", id)
      .eq("user_id", userId)
      .eq("kind", "change_set")
      .single(),
    db
      .from("agent_artifacts")
      .select("content")
      .eq("run_id", id)
      .eq("user_id", userId)
      .eq("kind", "summary")
      .single(),
    db.from("github_connections").select("access_token").eq("user_id", userId).single(),
  ]);
  if (connectionResult.error || !connectionResult.data?.access_token) {
    return NextResponse.json(
      { error: "Connect GitHub in Settings before approving delivery." },
      { status: 409 },
    );
  }
  if (taskResult.error || !taskResult.data || changeSetResult.error || !changeSetResult.data?.content) {
    return NextResponse.json({ error: "The delivery payload is incomplete." }, { status: 409 });
  }

  const { data: approval, error: claimError } = await db
    .from("agent_approvals")
    .update({ status: "delivering", decided_at: new Date().toISOString() })
    .eq("run_id", id)
    .eq("user_id", userId)
    .eq("action", "open_pull_request")
    .in("status", ["pending", "failed"])
    .select("*")
    .single();
  if (claimError || !approval) {
    return NextResponse.json(
      { error: "Delivery is already running or was previously approved." },
      { status: 409 },
    );
  }

  try {
    const parsed = JSON.parse(changeSetResult.data.content) as {
      version?: unknown;
      baseCommitSha?: unknown;
      files?: unknown;
    };
    if (
      parsed.version !== 1
      || typeof parsed.baseCommitSha !== "string"
      || !Array.isArray(parsed.files)
    ) {
      throw new Error("Unsupported delivery payload");
    }
    const changes = parsed.files as AgentChange[];
    const delivered = await createGitHubPullRequest({
      token: connectionResult.data.access_token,
      repository: taskResult.data.repo_url,
      baseRef: taskResult.data.base_ref,
      expectedBaseSha: parsed.baseCommitSha,
      runId: run.id,
      task: taskResult.data.task,
      summary: summaryResult.data?.content ?? "Locus completed the requested engineering task.",
      changes,
    });
    const completedAt = new Date().toISOString();

    const [approvalUpdate, artifactInsert] = await Promise.all([
      db
        .from("agent_approvals")
        .update({
          status: "approved",
          decided_at: completedAt,
          payload: {
            ...(typeof approval.payload === "object" && approval.payload && !Array.isArray(approval.payload)
              ? approval.payload
              : {}),
            branch: delivered.branch,
            pullRequestNumber: delivered.pullRequestNumber,
            url: delivered.url,
          },
        })
        .eq("id", approval.id),
      db.from("agent_artifacts").insert({
        run_id: id,
        user_id: userId,
        kind: "pull_request",
        label: `Pull request #${delivered.pullRequestNumber}`,
        url: delivered.url,
      }),
    ]);
    if (approvalUpdate.error || artifactInsert.error) {
      throw new Error("GitHub delivery succeeded, but the run ledger could not be finalized");
    }
    await appendRunStep({
      runId: id,
      userId,
      sequence: 5,
      kind: "delivery",
      status: "completed",
      title: "Pull request opened after approval",
      detail: { url: delivered.url, branch: delivered.branch },
    });
    await transitionRun({
      runId: id,
      userId,
      current: "awaiting_approval",
      next: "completed",
      values: {
        branch_name: delivered.branch,
        error: null,
        completed_at: completedAt,
      },
    });

    return NextResponse.json({ delivery: delivered });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1_000) : "GitHub delivery failed";
    await Promise.all([
      db
        .from("agent_approvals")
        .update({ status: "failed", payload: { error: message } })
        .eq("id", approval.id),
      db
        .from("agent_runs")
        .update({ error: `Delivery failed: ${message}` })
        .eq("id", id)
        .eq("user_id", userId),
    ]);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

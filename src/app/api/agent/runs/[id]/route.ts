import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { calculateTokenLedger } from "@/lib/agent/coding-agent";
import { controlledAlphaTokenView } from "@/lib/agent/run-view";
import { serviceClient } from "@/lib/supabase";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
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
    .single();
  if (runError || !run) return NextResponse.json({ error: "Agent run not found." }, { status: 404 });

  const [taskResult, stepsResult, artifactsResult, approvalsResult] = await Promise.all([
    db.from("agent_tasks").select("*").eq("id", run.task_id).eq("user_id", userId).single(),
    db.from("agent_steps").select("*").eq("run_id", id).eq("user_id", userId).order("sequence"),
    db.from("agent_artifacts").select("*").eq("run_id", id).eq("user_id", userId).order("created_at"),
    db.from("agent_approvals").select("*").eq("run_id", id).eq("user_id", userId).order("created_at"),
  ]);

  if (
    taskResult.error
    || stepsResult.error
    || artifactsResult.error
    || approvalsResult.error
  ) {
    return NextResponse.json({ error: "Could not load complete run evidence." }, { status: 500 });
  }

  const tokenLedger = calculateTokenLedger({
    baselineContextTokens: run.baseline_tokens,
    includedContextTokens: run.included_context_tokens,
    inputTokens: run.input_tokens,
    cachedInputTokens: run.cached_input_tokens,
    outputTokens: run.output_tokens,
  });
  return NextResponse.json({
    run,
    task: taskResult.data,
    steps: stepsResult.data,
    artifacts: artifactsResult.data,
    approvals: approvalsResult.data,
    tokens: controlledAlphaTokenView(tokenLedger),
  });
}

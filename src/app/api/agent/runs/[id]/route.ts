import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { calculateTokenLedger } from "@/lib/agent/coding-agent";
import { controlledAlphaTokenView } from "@/lib/agent/run-view";
import { tenantDb } from "@/lib/db";

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

  const db = tenantDb(userId);
  const run = await db
    .selectFrom("agent_runs")
    .selectAll()
    .where("id", "=", id)
    .where("user_id", "=", userId)
    .executeTakeFirst()
    .catch(() => undefined);
  if (!run) return NextResponse.json({ error: "Agent run not found." }, { status: 404 });

  let evidence;
  try {
    evidence = await Promise.all([
      db.selectFrom("agent_tasks").selectAll().where("id", "=", run.task_id).where("user_id", "=", userId)
        .executeTakeFirstOrThrow(),
      db.selectFrom("agent_steps").selectAll().where("run_id", "=", id).where("user_id", "=", userId)
        .orderBy("sequence").execute(),
      db.selectFrom("agent_artifacts").selectAll().where("run_id", "=", id).where("user_id", "=", userId)
        .orderBy("created_at").execute(),
      db.selectFrom("agent_approvals").selectAll().where("run_id", "=", id).where("user_id", "=", userId)
        .orderBy("created_at").execute(),
      db.selectFrom("agent_reviews").selectAll().where("run_id", "=", id).where("user_id", "=", userId)
        .orderBy("created_at").execute(),
    ]);
  } catch {
    return NextResponse.json({ error: "Could not load complete run evidence." }, { status: 500 });
  }
  const [task, steps, artifacts, approvals, reviews] = evidence;

  const tokenLedger = calculateTokenLedger({
    baselineContextTokens: run.baseline_tokens,
    includedContextTokens: run.included_context_tokens,
    inputTokens: run.input_tokens,
    cachedInputTokens: run.cached_input_tokens,
    outputTokens: run.output_tokens,
  });
  return NextResponse.json({
    run,
    task,
    steps,
    artifacts,
    approvals,
    reviews,
    tokens: controlledAlphaTokenView(tokenLedger),
  });
}

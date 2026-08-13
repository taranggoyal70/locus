import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getRun } from "workflow/api";

import { releaseRunProviderLease, transitionRun } from "@/lib/agent/run-store";
import { isRunStatus, isTerminalRun } from "@/lib/agent/run-state";
import { logger } from "@/lib/logger";
import { sameOriginMutation } from "@/lib/request-security";
import { tenantClient } from "@/lib/supabase-tenant";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * Cancelling a Run is the only way out of a stuck one.
 *
 * Without this, a Run whose workflow died mid-flight stays non-terminal forever:
 * it holds one of the user's two active slots with no self-service recovery, and
 * if it died before the lease step it also holds the deployment-wide provider
 * lease for an hour while `max_concurrent` is 1 — so one crashed Run blocks Agent
 * Runs for everybody. The state machine already permits the transition from any
 * non-terminal status; only the route was missing.
 *
 */
export async function POST(request: Request, context: RouteContext) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!sameOriginMutation(request)) {
    return NextResponse.json({ error: "Cross-site requests are not allowed." }, { status: 403 });
  }

  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid run identifier." }, { status: 400 });
  }

  // Tenant-scoped read: a Run belonging to another user must be indistinguishable
  // from one that does not exist.
  const db = tenantClient(userId);
  const { data: run, error: runError } = await db
    .from("agent_runs")
    .select("id,status,workflow_run_id")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (runError || !run) return NextResponse.json({ error: "Agent run not found." }, { status: 404 });
  if (!isRunStatus(run.status)) {
    return NextResponse.json({ error: "Agent run has an unrecognized status." }, { status: 409 });
  }
  if (isTerminalRun(run.status)) {
    return NextResponse.json(
      { error: `Agent run has already finished (${run.status}).` },
      { status: 409 },
    );
  }

  if (run.workflow_run_id) {
    try {
      await getRun(run.workflow_run_id).cancel();
    } catch (error) {
      logger.error(
        "agent.workflow.cancel_failed",
        { cause: error instanceof Error ? error.message : String(error) },
        id,
      );
      return NextResponse.json(
        { error: "The durable workflow could not be cancelled." },
        { status: 503 },
      );
    }
  }

  await transitionRun({
    runId: id,
    userId,
    current: run.status,
    next: "cancelled",
    values: { error: "Cancelled by the user.", completed_at: new Date().toISOString() },
  });

  if (run.workflow_run_id) {
    try {
      await releaseRunProviderLease(id);
    } catch (error) {
      logger.error(
        "agent.run.cancel_lease_release_failed",
        { cause: error instanceof Error ? error.message : String(error) },
        id,
      );
    }
  }

  logger.info("agent.run.cancelled", { from: run.status }, id);
  return NextResponse.json({ id, status: "cancelled" });
}

import { ACTIVE_RUN_STATUSES } from "@/lib/agent/run-state";
import { tenantClient } from "@/lib/supabase-tenant";

/** What an account has spent against its Run quota right now. */
export type RunUsage = {
  activeRuns: number;
  dailyRuns: number;
};

const DAY_MS = 24 * 60 * 60 * 1_000;

/**
 * The two counts a Run quota is measured against.
 *
 * Extracted because the Run start path and the workspace both need them and had
 * no shared definition. Two hand-written copies of "runs in the last 24 hours"
 * is how a user is shown one number and refused against another - and the number
 * they are shown is the one they will quote back when they complain.
 *
 * Counted with `head: true`: the answer is two integers, and moving every Run
 * row to the server to arrive at them would be slower and would widen what this
 * read can see for no gain.
 *
 * The 24-hour window is a rolling one, matching `claim_agent_run_slot`, which is
 * the authority. A calendar-day window here would disagree with the database
 * every evening.
 */
export async function readRunUsage(userId: string): Promise<RunUsage> {
  const db = tenantClient(userId);
  const since = new Date(Date.now() - DAY_MS).toISOString();

  const [active, daily] = await Promise.all([
    db
      .from("agent_runs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", [...ACTIVE_RUN_STATUSES]),
    db
      .from("agent_runs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", since),
  ]);

  if (active.error || daily.error) {
    throw new Error("Run usage could not be read");
  }

  return { activeRuns: active.count ?? 0, dailyRuns: daily.count ?? 0 };
}

import { ACTIVE_RUN_STATUSES } from "@/lib/agent/run-state";
import { tenantDb } from "@/lib/db";

/** What an account has spent against its Run quota right now. */
export type RunUsage = {
  activeRuns: number;
  runsInLast24Hours: number;
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
 * Counted in the database: the answer is two integers, and moving every Run
 * row to the server to arrive at them would be slower and would widen what this
 * read can see for no gain.
 *
 * The 24-hour window is a rolling one, matching `claim_agent_run_slot`, which is
 * the authority. A calendar-day window here would disagree with the database
 * every evening.
 */
export async function readRunUsage(userId: string): Promise<RunUsage> {
  const db = tenantDb(userId);
  const since = new Date(Date.now() - DAY_MS).toISOString();

  try {
    const [active, rollingWindow] = await Promise.all([
      db
        .selectFrom("agent_runs")
        .select((eb) => eb.fn.countAll<number>().as("count"))
        .where("user_id", "=", userId)
        .where("status", "in", [...ACTIVE_RUN_STATUSES])
        .executeTakeFirstOrThrow(),
      db
        .selectFrom("agent_runs")
        .select((eb) => eb.fn.countAll<number>().as("count"))
        .where("user_id", "=", userId)
        .where("created_at", ">=", since)
        // A provider-capacity refusal happens before the workflow starts. Keep
        // the failed Run as truthful evidence, but do not spend one of the
        // account's two attempts on work that never executed. `<>` is SQL's,
        // so a NULL failure_kind does not satisfy the middle clause, matching
        // claim_agent_run_slot.
        .where((eb) => eb.or([
          eb("status", "<>", "failed"),
          eb("failure_kind", "<>", "quota_exhausted"),
          eb("workflow_run_id", "is not", null),
        ]))
        .executeTakeFirstOrThrow(),
    ]);
    return {
      activeRuns: Number(active.count),
      runsInLast24Hours: Number(rollingWindow.count),
    };
  } catch (error) {
    throw new Error("Run usage could not be read", { cause: error });
  }
}

import { sql } from "kysely";
import { describe, expect, it } from "vitest";

import { readRunUsage } from "@/lib/agent/run-usage";
import { ACTIVE_RUN_STATUSES } from "@/lib/agent/run-state";
import { setupTestDatabase } from "@/test/database";
import { seedRun } from "@/test/fixtures";

const database = setupTestDatabase();
const HOUR_MS = 60 * 60 * 1_000;

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * HOUR_MS).toISOString();
}

describe("readRunUsage", () => {
  it("reports the active and rolling-day counts", async () => {
    await seedRun(database(), "user_1", { status: "queued" });
    await seedRun(database(), "user_1", { status: "completed" });
    await seedRun(database(), "user_1", { status: "completed", created_at: hoursAgo(30) });

    expect(await readRunUsage("user_1")).toEqual({ activeRuns: 1, runsInLast24Hours: 2 });
  });

  it("counts only the caller's Runs", async () => {
    await seedRun(database(), "user_1", { status: "queued" });
    await seedRun(database(), "user_2", { status: "queued" });
    await seedRun(database(), "user_2", { status: "localizing" });

    expect(await readRunUsage("user_1")).toEqual({ activeRuns: 1, runsInLast24Hours: 1 });
  });

  it("measures the day as a rolling window, matching the authoritative claim", async () => {
    // claim_agent_run_slot uses `now() - interval '24 hours'`. A calendar-day
    // window here would disagree with the database every evening, refusing a
    // user the interface had just told was clear.
    await seedRun(database(), "user_1", { status: "completed", created_at: hoursAgo(23.9) });
    await seedRun(database(), "user_1", { status: "completed", created_at: hoursAgo(24.1) });

    expect((await readRunUsage("user_1")).runsInLast24Hours).toBe(1);
  });

  it("does not charge attempts rejected before provider execution", async () => {
    // Refused for provider capacity before the workflow started: kept as
    // evidence, not charged.
    await seedRun(database(), "user_1", { status: "failed", failure_kind: "quota_exhausted" });
    // Each of these did execute, or failed for another reason, and is charged.
    await seedRun(database(), "user_1", {
      status: "failed",
      failure_kind: "quota_exhausted",
      workflow_run_id: "wrun_started",
    });
    await seedRun(database(), "user_1", { status: "failed", failure_kind: "workflow_error" });
    await seedRun(database(), "user_1", { status: "completed" });

    expect((await readRunUsage("user_1")).runsInLast24Hours).toBe(3);
  });

  it("counts exactly the statuses the Run lifecycle calls active", async () => {
    for (const status of ACTIVE_RUN_STATUSES) await seedRun(database(), "user_1", { status });
    for (const status of ["completed", "failed", "cancelled", "rejected"]) {
      await seedRun(database(), "user_1", { status });
    }

    expect((await readRunUsage("user_1")).activeRuns).toBe(ACTIVE_RUN_STATUSES.length);
  });

  it("throws rather than reporting zero when a count fails", async () => {
    // Zero would read as "no Runs used", which admits a Run the account may not
    // be entitled to. The authoritative claim would still refuse it, but the
    // user would have been told they had room.
    await sql`drop table public.agent_runs cascade`.execute(database());

    await expect(readRunUsage("user_1")).rejects.toThrow(/usage/i);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/cron/retention/route";
import { setupTestDatabase } from "@/test/database";
import { seedRun } from "@/test/fixtures";

const database = setupTestDatabase();
const DAY_MS = 24 * 60 * 60 * 1_000;

function daysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

function cron(secret = "expected-secret") {
  return GET(new Request("http://localhost/api/cron/retention", {
    headers: { authorization: `Bearer ${secret}` },
  }));
}

describe("daily data retention job", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails closed when the cron secret is missing or wrong", async () => {
    expect((await GET(new Request("http://localhost/api/cron/retention"))).status).toBe(503);
    vi.stubEnv("CRON_SECRET", "expected-secret");
    expect((await cron("wrong-secret")).status).toBe(401);
  });

  it("deletes finished Runs past the 30-day window and keeps everything else", async () => {
    vi.stubEnv("CRON_SECRET", "expected-secret");
    const expired = await seedRun(database(), "user_1", { status: "completed", completed_at: daysAgo(31) });
    const recent = await seedRun(database(), "user_1", { status: "completed", completed_at: daysAgo(29) });
    const active = await seedRun(database(), "user_1", { status: "executing", created_at: daysAgo(40) });
    await database().insertInto("waitlist").values([
      { email: "old@example.com", created_at: daysAgo(91) },
      { email: "new@example.com", created_at: daysAgo(10) },
    ]).execute();

    const response = await cron();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      deleted: { deleted_runs: 1, deleted_tasks: 0, deleted_events: 0, deleted_waitlist_entries: 1 },
    });
    const runs = await database().selectFrom("agent_runs").select("id").execute();
    expect(runs.map((run) => run.id).sort()).toEqual([recent, active].sort());
    expect(runs.map((run) => run.id)).not.toContain(expired);
    const waitlist = await database().selectFrom("waitlist").select("email").execute();
    expect(waitlist).toEqual([{ email: "new@example.com" }]);
  });
});

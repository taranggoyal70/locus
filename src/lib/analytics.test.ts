import { sql } from "kysely";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setupTestDatabase } from "@/test/database";

const warnMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/logger", () => ({
  logger: { warn: warnMock },
}));

const { track } = await import("@/lib/analytics");
const database = setupTestDatabase();

describe("analytics delivery", () => {
  beforeEach(() => {
    warnMock.mockReset();
  });

  it("records the event, its owner and its properties", async () => {
    await track({ event: "agent_run_started", userId: "user_1", properties: { workflowCorrelated: true } });

    const rows = await database().selectFrom("events").select(["event", "user_id", "properties"]).execute();
    expect(rows).toEqual([{ event: "agent_run_started", user_id: "user_1", properties: { workflowCorrelated: true } }]);
    expect(warnMock).not.toHaveBeenCalled();
  });

  it("records an event that precedes any account", async () => {
    await track({ event: "alpha_access_requested", properties: { result: "new" } });

    const rows = await database().selectFrom("events").select(["event", "user_id"]).execute();
    expect(rows).toEqual([{ event: "alpha_access_requested", user_id: null }]);
  });

  it("stays non-blocking and logs a structured warning when the insert fails", async () => {
    await sql`drop table public.events cascade`.execute(database());

    await expect(track({
      event: "alpha_access_requested",
      properties: { result: "existing" },
    })).resolves.toBeUndefined();
    expect(warnMock).toHaveBeenCalledWith("analytics_insert_failed", {
      event: "alpha_access_requested",
      status: "database_error",
    });
  });
});

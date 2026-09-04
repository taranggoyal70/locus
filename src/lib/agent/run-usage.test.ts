import { beforeEach, describe, expect, it, vi } from "vitest";

import { ACTIVE_RUN_STATUSES } from "@/lib/agent/run-state";

type Query = {
  filters: Array<[string, unknown]>;
  count: number | null;
  error: { message: string } | null;
};

const queries: Query[] = [];
const outcomes: Array<{ count: number | null; error: { message: string } | null }> = [];

function builder() {
  const query: Query = { filters: [], count: null, error: null };
  queries.push(query);
  const chain = {
    select: () => chain,
    eq(column: string, value: unknown) {
      query.filters.push([column, value]);
      return chain;
    },
    in(column: string, value: unknown) {
      query.filters.push([column, value]);
      return chain;
    },
    gte(column: string, value: unknown) {
      query.filters.push([column, value]);
      return chain;
    },
    then(resolve: (value: { count: number | null; error: unknown }) => unknown) {
      const outcome = outcomes.shift() ?? { count: 0, error: null };
      return Promise.resolve(resolve(outcome));
    },
  };
  return chain;
}

vi.mock("@/lib/supabase-tenant", () => ({
  tenantClient: () => ({ from: () => builder() }),
}));

const { readRunUsage } = await import("@/lib/agent/run-usage");

beforeEach(() => {
  queries.length = 0;
  outcomes.length = 0;
});

describe("readRunUsage", () => {
  it("reports the active and daily counts", async () => {
    outcomes.push({ count: 1, error: null }, { count: 7, error: null });
    expect(await readRunUsage("user_1")).toEqual({ activeRuns: 1, dailyRuns: 7 });
  });

  it("counts only the caller's Runs", async () => {
    outcomes.push({ count: 0, error: null }, { count: 0, error: null });
    await readRunUsage("user_1");
    for (const query of queries) {
      expect(query.filters).toContainEqual(["user_id", "user_1"]);
    }
  });

  it("measures the day as a rolling window, matching the authoritative claim", async () => {
    // claim_agent_run_slot uses `now() - interval '24 hours'`. A calendar-day
    // window here would disagree with the database every evening, refusing a
    // user the interface had just told was clear.
    outcomes.push({ count: 0, error: null }, { count: 0, error: null });
    const before = Date.now();
    await readRunUsage("user_1");

    const since = queries
      .flatMap((query) => query.filters)
      .find(([column]) => column === "created_at")?.[1];
    expect(typeof since).toBe("string");
    const elapsed = before - Date.parse(since as string);
    expect(elapsed).toBeGreaterThanOrEqual(24 * 60 * 60 * 1_000 - 5_000);
    expect(elapsed).toBeLessThanOrEqual(24 * 60 * 60 * 1_000 + 5_000);
  });

  it("counts exactly the statuses the Run lifecycle calls active", async () => {
    outcomes.push({ count: 0, error: null }, { count: 0, error: null });
    await readRunUsage("user_1");
    expect(queries.flatMap((query) => query.filters)).toContainEqual([
      "status",
      [...ACTIVE_RUN_STATUSES],
    ]);
  });

  it("throws rather than reporting zero when a count fails", async () => {
    // Zero would read as "no Runs used", which admits a Run the account may not
    // be entitled to. The authoritative claim would still refuse it, but the
    // user would have been told they had room.
    outcomes.push({ count: null, error: { message: "connection reset" } }, { count: 0, error: null });
    await expect(readRunUsage("user_1")).rejects.toThrow(/usage/i);
  });
});

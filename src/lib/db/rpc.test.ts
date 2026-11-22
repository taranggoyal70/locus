import { sql } from "kysely";
import { describe, expect, it } from "vitest";

import { rpc } from "@/lib/db/rpc";
import { setupTestDatabase } from "@/test/database";
import { seedRun } from "@/test/fixtures";

const database = setupTestDatabase();

describe("rpc", () => {
  it("returns the rows of a table function", async () => {
    const rows = await rpc(database(), "consume_api_rate_limit", {
      p_bucket: "test:bucket",
      p_limit: 2,
      p_window_seconds: 60,
    });

    expect(rows).toEqual([{ allowed: true, remaining: 1, retry_after_seconds: 0 }]);
  });

  it("binds text[] arguments as a PostgreSQL array", async () => {
    // claim_agent_run_slot filters with `status = any(p_active_statuses)`, so a
    // wrongly bound array would count nothing and admit every Run.
    await seedRun(database(), "user_1", { status: "executing" });
    const task = await database().insertInto("agent_tasks")
      .values({ user_id: "user_1", repo_url: "https://github.com/a/b", task: "t" })
      .returning("id").executeTakeFirstOrThrow();

    const [claim] = await rpc(database(), "claim_agent_run_slot", {
      p_user_id: "user_1",
      p_task_id: task.id,
      p_model: "@cf/qwen/qwen3.8-27b",
      p_token_budget: 100_000,
      p_active_statuses: ["queued", "executing"],
      p_max_active: 1,
      p_max_daily: 10,
      p_provider: "cloudflare-workers-ai",
      p_execution_mode: "shared",
    });

    expect(claim).toMatchObject({ allowed: false, reason: "active", run_id: null });
  });

  it("refuses an argument the function does not declare", async () => {
    await expect(rpc(database(), "consume_api_rate_limit", {
      p_bucket: "test:bucket",
      p_limit: 2,
      p_window_seconds: 60,
      // @ts-expect-error -- deliberately not a declared argument
      p_bucket_override: "x",
    })).rejects.toThrow("consume_api_rate_limit has no argument named p_bucket_override");
  });

  it("surfaces a database error rather than an empty result", async () => {
    await sql`drop function public.consume_api_rate_limit`.execute(database());

    await expect(rpc(database(), "consume_api_rate_limit", {
      p_bucket: "test:bucket",
      p_limit: 2,
      p_window_seconds: 60,
    })).rejects.toThrow();
  });
});

import type { Insertable } from "kysely";

import type { AgentRunsTable, AgentTasksTable } from "@/lib/db/schema";
import type { TestDatabase } from "@/test/database";

/** Inserts an Agent Task and returns its id. */
export async function seedTask(
  database: TestDatabase,
  userId: string,
  values: Partial<Insertable<AgentTasksTable>> = {},
): Promise<string> {
  const { id } = await database
    .insertInto("agent_tasks")
    .values({ user_id: userId, repo_url: "https://github.com/acme/app", task: "fix the login redirect", ...values })
    .returning("id")
    .executeTakeFirstOrThrow();
  return id;
}

/** Inserts a Run (and a task for it unless one is given) and returns the Run id. */
export async function seedRun(
  database: TestDatabase,
  userId: string,
  values: Partial<Insertable<AgentRunsTable>> = {},
): Promise<string> {
  const taskId = values.task_id ?? await seedTask(database, userId);
  const { id } = await database
    .insertInto("agent_runs")
    .values({
      user_id: userId,
      task_id: taskId,
      model: "@cf/qwen/qwen3.8-27b",
      provider: "cloudflare-workers-ai",
      ...values,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  return id;
}

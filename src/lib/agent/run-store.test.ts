import { describe, expect, it } from "vitest";

import { failRun, transitionRun } from "@/lib/agent/run-store";
import { setupTestDatabase } from "@/test/database";
import { seedRun } from "@/test/fixtures";

const database = setupTestDatabase();

async function statusOf(runId: string) {
  const row = await database().selectFrom("agent_runs").select(["status", "error"]).where("id", "=", runId)
    .executeTakeFirstOrThrow();
  return row;
}

describe("transitionRun", () => {
  it("moves a Run from the expected status to the next one", async () => {
    const runId = await seedRun(database(), "user_owner", { status: "queued" });

    await transitionRun({ runId, userId: "user_owner", current: "queued", next: "localizing" });

    expect((await statusOf(runId)).status).toBe("localizing");
  });

  it("treats a durable-step replay as success when the Run already reached the target status", async () => {
    // The update committed, but the step result was not acknowledged, so the
    // workflow replays the step against a Run that has already moved.
    const runId = await seedRun(database(), "user_owner", { status: "localizing" });

    await expect(transitionRun({
      runId,
      userId: "user_owner",
      current: "queued",
      next: "localizing",
    })).resolves.toBeUndefined();
  });

  it("still rejects a stale transition when the Run is in a different status", async () => {
    const runId = await seedRun(database(), "user_owner", { status: "failed" });

    await expect(transitionRun({
      runId,
      userId: "user_owner",
      current: "queued",
      next: "localizing",
    })).rejects.toThrow("Run could not transition from queued to localizing");
    expect((await statusOf(runId)).status).toBe("failed");
  });

  it("never hides a competing transition to the same terminal status", async () => {
    // Another writer already failed the Run. Reporting this second failure as
    // success would let it believe its own error message was recorded.
    const runId = await seedRun(database(), "user_owner", { status: "failed", error: "first failure" });

    await expect(transitionRun({
      runId,
      userId: "user_owner",
      current: "queued",
      next: "failed",
      values: { error: "provider capacity failed" },
    })).rejects.toThrow("Run could not transition from queued to failed");
    expect(await statusOf(runId)).toEqual({ status: "failed", error: "first failure" });
  });

  it("cannot move another user's Run", async () => {
    const runId = await seedRun(database(), "user_owner", { status: "queued" });

    await expect(transitionRun({
      runId,
      userId: "user_intruder",
      current: "queued",
      next: "localizing",
    })).rejects.toThrow("Run could not transition");
    expect((await statusOf(runId)).status).toBe("queued");
  });
});

describe("failRun", () => {
  it("fails a non-terminal Run with the given reason", async () => {
    const runId = await seedRun(database(), "user_owner", { status: "executing" });

    await failRun(runId, "sandbox crashed", "workflow_error");

    const row = await database().selectFrom("agent_runs").select(["status", "error", "failure_kind", "completed_at"])
      .where("id", "=", runId).executeTakeFirstOrThrow();
    expect(row).toMatchObject({ status: "failed", error: "sandbox crashed", failure_kind: "workflow_error" });
    expect(row.completed_at).not.toBeNull();
  });

  it("leaves a terminal Run exactly as it is", async () => {
    const runId = await seedRun(database(), "user_owner", { status: "completed" });

    await failRun(runId, "late failure");

    expect(await statusOf(runId)).toEqual({ status: "completed", error: null });
  });

  it("does nothing for a Run that does not exist", async () => {
    await expect(failRun("00000000-0000-4000-8000-000000000000", "gone")).resolves.toBeUndefined();
  });
});

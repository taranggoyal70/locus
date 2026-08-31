import { beforeEach, describe, expect, it, vi } from "vitest";

const serviceClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase", () => ({ serviceClient: serviceClientMock }));

import { transitionRun } from "@/lib/agent/run-store";

function updateQuery(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ single }));
  const eqStatus = vi.fn(() => ({ select }));
  const eqUser = vi.fn(() => ({ eq: eqStatus }));
  const eqId = vi.fn(() => ({ eq: eqUser }));
  return { update: vi.fn(() => ({ eq: eqId })) };
}

function currentStatusQuery(status: string) {
  const single = vi.fn().mockResolvedValue({ data: { status }, error: null });
  const eqUser = vi.fn(() => ({ single }));
  const eqId = vi.fn(() => ({ eq: eqUser }));
  return { select: vi.fn(() => ({ eq: eqId })) };
}

describe("transitionRun", () => {
  beforeEach(() => {
    serviceClientMock.mockReset();
  });

  it("treats a durable-step replay as success when the Run already reached the target status", async () => {
    const update = updateQuery({ data: null, error: { code: "PGRST116" } });
    const current = currentStatusQuery("localizing");
    const from = vi.fn()
      .mockReturnValueOnce(update)
      .mockReturnValueOnce(current);
    serviceClientMock.mockReturnValue({ from });

    await expect(transitionRun({
      runId: "run_replayed",
      userId: "user_owner",
      current: "queued",
      next: "localizing",
    })).resolves.toBeUndefined();
  });

  it("still rejects a stale transition when the Run is in a different status", async () => {
    const update = updateQuery({ data: null, error: { code: "PGRST116" } });
    const current = currentStatusQuery("failed");
    const from = vi.fn()
      .mockReturnValueOnce(update)
      .mockReturnValueOnce(current);
    serviceClientMock.mockReturnValue({ from });

    await expect(transitionRun({
      runId: "run_stale",
      userId: "user_owner",
      current: "queued",
      next: "localizing",
    })).rejects.toThrow("Run could not transition from queued to localizing");
  });

  it("never hides a competing transition to the same terminal status", async () => {
    const update = updateQuery({ data: null, error: { code: "PGRST116" } });
    const current = currentStatusQuery("failed");
    const from = vi.fn()
      .mockReturnValueOnce(update)
      .mockReturnValueOnce(current);
    serviceClientMock.mockReturnValue({ from });

    await expect(transitionRun({
      runId: "run_terminal_race",
      userId: "user_owner",
      current: "queued",
      next: "failed",
      values: { error: "provider capacity failed" },
    })).rejects.toThrow("Run could not transition from queued to failed");
  });
});

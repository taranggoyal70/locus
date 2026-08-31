import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const consumeRateLimitMock = vi.hoisted(() => vi.fn());
const appendRunStepMock = vi.hoisted(() => vi.fn());
const transitionRunMock = vi.hoisted(() => vi.fn());
const releaseRunProviderLeaseMock = vi.hoisted(() => vi.fn());
const serviceClientMock = vi.hoisted(() => vi.fn());
const startMock = vi.hoisted(() => vi.fn());
const trackMock = vi.hoisted(() => vi.fn());
vi.mock("@clerk/nextjs/server", () => ({ auth: authMock }));
vi.mock("@/lib/analytics", () => ({ track: trackMock }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: consumeRateLimitMock }));
vi.mock("@/lib/agent/run-store", () => ({
  appendRunStep: appendRunStepMock,
  releaseRunProviderLease: releaseRunProviderLeaseMock,
  transitionRun: transitionRunMock,
}));
vi.mock("@/lib/supabase", () => ({ serviceClient: serviceClientMock }));
vi.mock("workflow/api", () => ({ start: startMock }));

import { POST } from "@/app/api/agent/runs/route";
import { ACTIVE_RUN_STATUSES } from "@/lib/agent/run-state";
import { MAX_ACTIVE_RUNS, MAX_DAILY_RUNS } from "@/lib/agent/run-quota";
import { CONTROLLED_ALPHA_DATA_POLICY_VERSION } from "@/lib/agent/run-request";

function runRequest() {
  return new Request("http://localhost/api/agent/runs", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify({
      repository: "vercel/next.js",
      baseRef: "main",
      task: "Fix the documented alpha capability guard",
      acceptanceCriteria: ["The guarded route rejects users outside the alpha"],
      dataPolicyAcceptance: { version: CONTROLLED_ALPHA_DATA_POLICY_VERSION },
    }),
  });
}

function queryResult(result: Record<string, unknown>) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "gte", "insert", "update", "delete"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.single = vi.fn(async () => result);
  builder.then = (
    resolve: (value: Record<string, unknown>) => unknown,
    reject: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return builder;
}

const ALLOWED_CLAIM = { allowed: true, reason: null, run_id: "run-id" };

function successfulDatabase(
  capacity = { allowed: true, retry_after_seconds: 0 },
  workflowUpdateError: Record<string, unknown> | null = null,
  claim: Record<string, unknown> | null = ALLOWED_CLAIM,
  claimError: Record<string, unknown> | null = null,
) {
  const from = vi.fn()
    .mockReturnValueOnce(queryResult({ count: 0, error: null }))
    .mockReturnValueOnce(queryResult({ count: 0, error: null }))
    .mockReturnValueOnce(queryResult({ data: { id: "task-id" }, error: null }))
    .mockReturnValueOnce(queryResult({
      data: {
        id: "run-id",
        task_id: "task-id",
        user_id: "user_design_partner",
        status: "queued",
        model: "openai/gpt-5.6-sol",
      },
      error: null,
    }))
    .mockReturnValueOnce(queryResult({ error: workflowUpdateError }));
  // Two different functions are called on this path, so the mock dispatches by
  // name. Returning one shape for both let the quota claim receive the provider
  // lease's fields, which is not a failure any real database can produce.
  const rpc = vi.fn(async (name: string) => {
    if (name === "claim_agent_run_slot") {
      return { data: claim ? [claim] : null, error: claimError };
    }
    return { data: [capacity], error: null };
  });
  serviceClientMock.mockReturnValue({ from, rpc });
  return { from, rpc };
}

describe("controlled-alpha Agent Run starts", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    authMock.mockResolvedValue({ userId: "user_outside_alpha" });
    consumeRateLimitMock.mockResolvedValue({ allowed: true, remaining: 2, retryAfterSeconds: 0 });
    appendRunStepMock.mockReset();
    transitionRunMock.mockReset();
    releaseRunProviderLeaseMock.mockReset();
    releaseRunProviderLeaseMock.mockResolvedValue(undefined);
    serviceClientMock.mockReset();
    startMock.mockReset();
    trackMock.mockReset();
    vi.stubEnv("ALPHA_ALLOWED_USER_IDS", "user_design_partner");
  });

  it("rejects authenticated users outside the design-partner allowlist", async () => {
    const response = await POST(runRequest());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Agent Runs are limited to invited design partners during early access.",
    });
  });

  it("enforces durable start throttling for an invited user", async () => {
    authMock.mockResolvedValueOnce({ userId: "user_design_partner" });
    consumeRateLimitMock.mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterSeconds: 37 });

    const response = await POST(runRequest());

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("37");
  });

  it("records versioned data-policy evidence before starting the workflow", async () => {
    const events: string[] = [];
    authMock.mockResolvedValueOnce({ userId: "user_design_partner" });
    successfulDatabase();
    appendRunStepMock.mockImplementationOnce(async () => { events.push("policy"); });
    startMock.mockImplementationOnce(async () => {
      events.push("workflow");
      return { runId: "workflow-id" };
    });

    const response = await POST(runRequest());

    expect(response.status).toBe(202);
    expect(events).toEqual(["policy", "workflow"]);
    expect(trackMock).toHaveBeenCalledWith({
      event: "agent_run_started",
      userId: "user_design_partner",
      properties: { workflowCorrelated: true },
    });
    expect(appendRunStepMock).toHaveBeenCalledWith(expect.objectContaining({
      runId: "run-id",
      sequence: 0,
      kind: "approval",
      detail: expect.objectContaining({
        policyVersion: CONTROLLED_ALPHA_DATA_POLICY_VERSION,
        acceptedAt: expect.any(String),
      }),
    }));
  });

  // R12: the advisory count-then-insert let concurrent requests all pass. The
  // authoritative decision is the claim, so a denial from it must be honoured
  // even though the pre-check above said there was room.
  it("refuses the Run when the atomic claim denies it despite the pre-check passing", async () => {
    authMock.mockResolvedValueOnce({ userId: "user_design_partner" });
    const { rpc } = successfulDatabase(
      { allowed: true, retry_after_seconds: 0 },
      null,
      { allowed: false, reason: "active", run_id: null },
    );

    const response = await POST(runRequest());

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(rpc).toHaveBeenCalledWith("claim_agent_run_slot", expect.objectContaining({
      p_user_id: "user_design_partner",
      p_max_active: MAX_ACTIVE_RUNS,
      p_max_daily: MAX_DAILY_RUNS,
      p_active_statuses: [...ACTIVE_RUN_STATUSES],
    }));
    // No workflow, and no provider lease taken for a Run that was never created.
    expect(rpc).not.toHaveBeenCalledWith("acquire_agent_provider_lease", expect.anything());
    expect(startMock).not.toHaveBeenCalled();
  });

  it("reports the daily limit with its own retry window", async () => {
    authMock.mockResolvedValueOnce({ userId: "user_design_partner" });
    successfulDatabase(
      { allowed: true, retry_after_seconds: 0 },
      null,
      { allowed: false, reason: "daily", run_id: null },
    );

    const response = await POST(runRequest());

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("3600");
  });

  it("fails closed when the claim itself errors", async () => {
    authMock.mockResolvedValueOnce({ userId: "user_design_partner" });
    successfulDatabase(
      { allowed: true, retry_after_seconds: 0 },
      null,
      null,
      { message: "deadlock detected" },
    );

    const response = await POST(runRequest());

    // 503 rather than 429: the quota was never decided, so telling the caller to
    // retry after a quota window would be a guess.
    expect(response.status).toBe(503);
    expect(startMock).not.toHaveBeenCalled();
  });

  it("fails closed when an allowed claim carries no run id", async () => {
    authMock.mockResolvedValueOnce({ userId: "user_design_partner" });
    successfulDatabase(
      { allowed: true, retry_after_seconds: 0 },
      null,
      { allowed: true, reason: null, run_id: null },
    );

    const response = await POST(runRequest());

    expect(response.status).toBe(500);
    expect(startMock).not.toHaveBeenCalled();
  });

  it("fails closed when free-tier provider capacity is reserved by another Run", async () => {
    authMock.mockResolvedValueOnce({ userId: "user_design_partner" });
    const { rpc } = successfulDatabase({ allowed: false, retry_after_seconds: 41 });

    const response = await POST(runRequest());

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("41");
    expect(rpc).toHaveBeenCalledWith("acquire_agent_provider_lease", expect.objectContaining({
      p_run_id: "run-id",
      p_max_concurrent: 1,
    }));
    expect(startMock).not.toHaveBeenCalled();
  });

  it("fails closed when data-policy evidence cannot be recorded", async () => {
    authMock.mockResolvedValueOnce({ userId: "user_design_partner" });
    successfulDatabase();
    appendRunStepMock.mockRejectedValueOnce(new Error("step insert failed"));
    transitionRunMock.mockResolvedValueOnce(undefined);

    const response = await POST(runRequest());

    expect(response.status).toBe(503);
    expect(startMock).not.toHaveBeenCalled();
    expect(transitionRunMock).toHaveBeenCalledWith(expect.objectContaining({
      runId: "run-id",
      current: "queued",
      next: "failed",
    }));
  });

  it("fails closed before persistence when the deployment token budget is invalid", async () => {
    authMock.mockResolvedValueOnce({ userId: "user_design_partner" });
    vi.stubEnv("LOCUS_RUN_TOKEN_BUDGET", "unbounded");

    const response = await POST(runRequest());

    expect(response.status).toBe(503);
    expect(serviceClientMock).not.toHaveBeenCalled();
  });

  it("keeps a successfully started workflow alive when correlation persistence fails", async () => {
    authMock.mockResolvedValueOnce({ userId: "user_design_partner" });
    successfulDatabase(
      { allowed: true, retry_after_seconds: 0 },
      { message: "workflow id update failed" },
    );
    appendRunStepMock.mockResolvedValueOnce(undefined);
    startMock.mockResolvedValueOnce({ runId: "workflow-id" });

    const response = await POST(runRequest());

    expect(response.status).toBe(202);
    expect(transitionRunMock).not.toHaveBeenCalledWith(expect.objectContaining({ next: "failed" }));
  });
});

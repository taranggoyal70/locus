import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const transitionRunMock = vi.hoisted(() => vi.fn());
const releaseRunProviderLeaseMock = vi.hoisted(() => vi.fn());
const getRunMock = vi.hoisted(() => vi.fn());
const workflowCancelMock = vi.hoisted(() => vi.fn());
const workflowStatusMock = vi.hoisted(() => vi.fn());
const singleMock = vi.hoisted(() => vi.fn());

vi.mock("@clerk/nextjs/server", () => ({ auth: authMock }));
vi.mock("workflow/api", () => ({ getRun: getRunMock }));
vi.mock("@/lib/agent/run-store", () => ({
  transitionRun: transitionRunMock,
  releaseRunProviderLease: releaseRunProviderLeaseMock,
}));
vi.mock("@/lib/supabase-tenant", () => ({
  tenantClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ single: singleMock }) }) }),
    }),
  }),
}));

import { POST } from "@/app/api/agent/runs/[id]/cancel/route";

const RUN_ID = "3f8a1c2e-5b4d-4e7a-9c1f-0a2b3c4d5e6f";

function context(id = RUN_ID) {
  return { params: Promise.resolve({ id }) };
}

function request(headers: Record<string, string> = { origin: "https://locus.example" }) {
  return new Request(`https://locus.example/api/agent/runs/${RUN_ID}/cancel`, {
    method: "POST",
    headers,
  });
}

describe("cancel an agent run", () => {
  beforeEach(() => {
    authMock.mockResolvedValue({ userId: "user_123" });
    transitionRunMock.mockReset().mockResolvedValue(undefined);
    releaseRunProviderLeaseMock.mockReset().mockResolvedValue(undefined);
    workflowStatusMock.mockReset().mockResolvedValue("running");
    getRunMock.mockReset().mockReturnValue({
      cancel: workflowCancelMock,
      get status() {
        return workflowStatusMock();
      },
    });
    workflowCancelMock.mockReset().mockResolvedValue(undefined);
    singleMock.mockReset().mockResolvedValue({
      data: { id: RUN_ID, status: "executing", workflow_run_id: "workflow-id" },
      error: null,
    });
  });

  it("cancels a running durable workflow without releasing provider capacity early", async () => {
    const events: string[] = [];
    workflowCancelMock.mockImplementationOnce(async () => { events.push("workflow"); });
    transitionRunMock.mockImplementationOnce(async () => { events.push("transition"); });

    const response = await POST(request(), context());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: RUN_ID, status: "cancelled" });
    expect(getRunMock).toHaveBeenCalledWith("workflow-id");
    expect(transitionRunMock).toHaveBeenCalledWith(expect.objectContaining({
      runId: RUN_ID,
      userId: "user_123",
      current: "executing",
      next: "cancelled",
    }));
    expect(releaseRunProviderLeaseMock).not.toHaveBeenCalled();
    expect(events).toEqual(["workflow", "transition"]);
  });

  it("reconciles an already-terminal workflow and releases provider capacity", async () => {
    workflowStatusMock.mockResolvedValueOnce("completed");

    const response = await POST(request(), context());

    expect(response.status).toBe(200);
    expect(workflowCancelMock).not.toHaveBeenCalled();
    expect(transitionRunMock).toHaveBeenCalledWith(expect.objectContaining({ next: "cancelled" }));
    expect(releaseRunProviderLeaseMock).toHaveBeenCalledWith(RUN_ID);
  });

  it("releases provider capacity after cancelling a non-executing workflow", async () => {
    workflowStatusMock.mockResolvedValueOnce("pending");

    const response = await POST(request(), context());

    expect(response.status).toBe(200);
    expect(workflowCancelMock).toHaveBeenCalled();
    expect(transitionRunMock).toHaveBeenCalledWith(expect.objectContaining({ next: "cancelled" }));
    expect(releaseRunProviderLeaseMock).toHaveBeenCalledWith(RUN_ID);
  });

  it("cancels from any non-terminal status", async () => {
    for (const status of ["queued", "localizing", "planning", "executing", "verifying"]) {
      singleMock.mockResolvedValueOnce({
        data: { id: RUN_ID, status, workflow_run_id: "workflow-id" },
        error: null,
      });

      const response = await POST(request(), context());

      expect(response.status, status).toBe(200);
    }
  });

  it("refuses a run that already finished", async () => {
    singleMock.mockResolvedValueOnce({ data: { id: RUN_ID, status: "completed" }, error: null });

    const response = await POST(request(), context());

    expect(response.status).toBe(409);
    expect(transitionRunMock).not.toHaveBeenCalled();
    expect(releaseRunProviderLeaseMock).not.toHaveBeenCalled();
  });

  it("does not mark the Run cancelled when workflow cancellation fails ambiguously", async () => {
    workflowCancelMock.mockRejectedValueOnce(new Error("workflow unavailable"));
    workflowStatusMock.mockResolvedValueOnce("running").mockResolvedValueOnce("running");

    const response = await POST(request(), context());

    expect(response.status).toBe(503);
    expect(transitionRunMock).not.toHaveBeenCalled();
    expect(releaseRunProviderLeaseMock).not.toHaveBeenCalled();
  });

  it("reconciles terminal workflow state after a cancellation conflict", async () => {
    workflowStatusMock.mockResolvedValueOnce("pending").mockResolvedValueOnce("cancelled");
    workflowCancelMock.mockRejectedValueOnce(new Error("run is already terminal"));

    const response = await POST(request(), context());

    expect(response.status).toBe(200);
    expect(transitionRunMock).toHaveBeenCalledWith(expect.objectContaining({ next: "cancelled" }));
    expect(releaseRunProviderLeaseMock).toHaveBeenCalledWith(RUN_ID);
  });

  it("does not release provider capacity without a workflow handle", async () => {
    singleMock.mockResolvedValueOnce({
      data: { id: RUN_ID, status: "executing", workflow_run_id: null },
      error: null,
    });

    const response = await POST(request(), context());

    expect(response.status).toBe(200);
    expect(getRunMock).not.toHaveBeenCalled();
    expect(transitionRunMock).toHaveBeenCalledWith(expect.objectContaining({ next: "cancelled" }));
    expect(releaseRunProviderLeaseMock).not.toHaveBeenCalled();
  });

  it("still succeeds when terminal reconciliation capacity release fails", async () => {
    workflowStatusMock.mockResolvedValueOnce("completed");
    releaseRunProviderLeaseMock.mockRejectedValueOnce(new Error("rpc unavailable"));

    const response = await POST(request(), context());

    expect(response.status).toBe(200);
    expect(transitionRunMock).toHaveBeenCalled();
  });

  it("requires authentication", async () => {
    authMock.mockResolvedValueOnce({ userId: null });

    expect((await POST(request(), context())).status).toBe(401);
    expect(transitionRunMock).not.toHaveBeenCalled();
  });

  it("rejects a cross-site request", async () => {
    const response = await POST(request({ "sec-fetch-site": "cross-site" }), context());

    expect(response.status).toBe(403);
    expect(transitionRunMock).not.toHaveBeenCalled();
  });

  it("rejects a request without same-origin browser evidence", async () => {
    const response = await POST(request({}), context());

    expect(response.status).toBe(403);
    expect(transitionRunMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed run identifier", async () => {
    const response = await POST(request(), context("not-a-uuid"));

    expect(response.status).toBe(400);
    expect(transitionRunMock).not.toHaveBeenCalled();
  });

  it("reports another user's run as not found", async () => {
    singleMock.mockResolvedValueOnce({ data: null, error: { message: "no rows" } });

    const response = await POST(request(), context());

    expect(response.status).toBe(404);
    expect(transitionRunMock).not.toHaveBeenCalled();
  });
});

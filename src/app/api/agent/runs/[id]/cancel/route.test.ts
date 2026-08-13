import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const transitionRunMock = vi.hoisted(() => vi.fn());
const releaseRunProviderLeaseMock = vi.hoisted(() => vi.fn());
const singleMock = vi.hoisted(() => vi.fn());

vi.mock("@clerk/nextjs/server", () => ({ auth: authMock }));
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

function request(headers: Record<string, string> = {}) {
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
    singleMock.mockReset().mockResolvedValue({ data: { id: RUN_ID, status: "executing" }, error: null });
  });

  it("cancels a stuck run and releases the deployment-wide provider lease", async () => {
    const response = await POST(request(), context());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: RUN_ID, status: "cancelled" });
    expect(transitionRunMock).toHaveBeenCalledWith(expect.objectContaining({
      runId: RUN_ID,
      userId: "user_123",
      current: "executing",
      next: "cancelled",
    }));
    // Freeing the user's own slot without releasing the lease would leave every
    // other user blocked for the rest of the lease window.
    expect(releaseRunProviderLeaseMock).toHaveBeenCalledWith(RUN_ID);
  });

  it("cancels from any non-terminal status", async () => {
    for (const status of ["queued", "localizing", "planning", "executing", "verifying"]) {
      singleMock.mockResolvedValueOnce({ data: { id: RUN_ID, status }, error: null });

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

  it("still succeeds when releasing capacity fails", async () => {
    releaseRunProviderLeaseMock.mockRejectedValueOnce(new Error("rpc unavailable"));

    const response = await POST(request(), context());

    // The Run is terminal and the user's slot is freed either way; the lease
    // expires on its own, so failing the request would help nobody.
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

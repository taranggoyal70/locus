import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const decideRunProposalMock = vi.hoisted(() => vi.fn());
vi.mock("@clerk/nextjs/server", () => ({ auth: authMock }));
vi.mock("@/lib/agent/run-store", () => ({ decideRunProposal: decideRunProposalMock }));

import { POST } from "@/app/api/agent/runs/[id]/review/route";

const runId = "00000000-0000-4000-8000-000000000001";
const proposalHash = "a".repeat(64);

function reviewRequest(body: unknown, origin = "http://localhost") {
  return new Request(`http://localhost/api/agent/runs/${runId}/review`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify(body),
  });
}

describe("artifact-bound Agent review", () => {
  beforeEach(() => {
    authMock.mockResolvedValue({ userId: "user_design_partner" });
    decideRunProposalMock.mockReset();
  });

  it("rejects cross-origin review mutations", async () => {
    const response = await POST(
      reviewRequest({}, "https://attacker.example"),
      { params: Promise.resolve({ id: runId }) },
    );
    expect(response.status).toBe(403);
  });

  it("passes the exact proposal hash and criterion decisions to the transactional RPC", async () => {
    decideRunProposalMock.mockResolvedValue({ status: "completed", reviewId: "review-id" });
    const criteria = [{ criterion: "Tests pass", satisfied: true, evidence: "pnpm test" }];

    const response = await POST(
      reviewRequest({ proposalHash, decision: "accepted", criteria }),
      { params: Promise.resolve({ id: runId }) },
    );

    expect(response.status).toBe(200);
    expect(decideRunProposalMock).toHaveBeenCalledWith({
      runId,
      userId: "user_design_partner",
      proposalHash,
      decision: "accepted",
      criteria,
      note: null,
    });
    await expect(response.json()).resolves.toEqual({
      status: "completed",
      reviewId: "review-id",
    });
  });

  it("fails closed when the proposal changed or the Run is no longer reviewable", async () => {
    decideRunProposalMock.mockRejectedValue(new Error("hash mismatch"));
    const response = await POST(
      reviewRequest({
        proposalHash,
        decision: "rejected",
        criteria: [{ criterion: "Tests pass", satisfied: false }],
      }),
      { params: Promise.resolve({ id: runId }) },
    );
    expect(response.status).toBe(409);
  });
});

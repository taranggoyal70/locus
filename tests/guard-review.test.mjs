import { describe, expect, it } from "vitest";
import { addHumanReview } from "../bin/guard-review.mjs";
import { canonicalJson, sha256 } from "../bin/guard.mjs";

function pendingReceipt(overrides = {}) {
  const body = {
    schemaVersion: "locus.guard.run-receipt.v1",
    enforcement: { result: "pass" },
    checks: [{ command: "pnpm test", result: "pass", exitCode: 0 }],
    candidate: { hash: "candidate-123" },
    review: { status: "pending" },
    ...overrides,
  };
  return { ...body, receiptHash: sha256(canonicalJson(body)) };
}

describe("Guard human Review", () => {
  it("refuses to accept a proposal with skipped Checks", () => {
    expect(() => addHumanReview(pendingReceipt({ checks: [] }), {
      decision: "accepted",
      actor: "reviewer@example.com",
      criteria: ["Candidate behavior reviewed"],
    })).toThrow(/requires at least one passing Check/);
  });

  it("allows a human to reject a failed proposal for audit history", () => {
    const reviewed = addHumanReview(pendingReceipt({
      enforcement: { result: "fail" },
      checks: [{ command: "pnpm test", result: "fail", exitCode: 1 }],
    }), {
      decision: "rejected",
      actor: "reviewer@example.com",
      criteria: ["Check evidence reviewed"],
    });

    expect(reviewed.review.status).toBe("rejected");
  });
});

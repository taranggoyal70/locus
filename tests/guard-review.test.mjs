import { describe, expect, it } from "vitest";
import { addHumanReview } from "../bin/guard-review.mjs";
import { canonicalJson, sha256 } from "../bin/guard.mjs";

function pendingReceipt(overrides = {}) {
  const records = [{
    path: "src/invoice.js",
    state: "modified",
    byteLength: 1,
    contentHash: "b".repeat(64),
    executable: false,
  }];
  const body = {
    schemaVersion: "locus.guard.run-receipt.v1",
    enforcement: { mode: "contained-agent-run", result: "pass" },
    checks: [{ command: "pnpm test", result: "pass", exitCode: 0 }],
    candidate: {
      hash: sha256(canonicalJson(records)),
      changedPaths: ["src/invoice.js"],
      records,
    },
    review: { status: "pending" },
    violations: [],
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
      enforcement: { mode: "contained-agent-run", result: "fail" },
      checks: [{ command: "pnpm test", result: "fail", exitCode: 1 }],
    }), {
      decision: "rejected",
      actor: "reviewer@example.com",
      criteria: ["Check evidence reviewed"],
    });

    expect(reviewed.review.status).toBe("rejected");
  });
});

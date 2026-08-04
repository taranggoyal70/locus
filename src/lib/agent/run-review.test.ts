import { describe, expect, it } from "vitest";

import { parseAgentReviewRequest, reviewDecisionAvailability } from "@/lib/agent/run-review";

describe("Agent proposal review request", () => {
  const proposalHash = "a".repeat(64);

  it("accepts criterion-level evidence bound to a proposal hash", () => {
    expect(parseAgentReviewRequest({
      proposalHash,
      decision: "accepted",
      criteria: [
        { criterion: "Tests pass", satisfied: true, evidence: "pnpm test passed" },
      ],
      note: "Reviewed the diff.",
    })).toEqual({
      proposalHash,
      decision: "accepted",
      criteria: [
        { criterion: "Tests pass", satisfied: true, evidence: "pnpm test passed" },
      ],
      note: "Reviewed the diff.",
    });
  });

  it("rejects malformed hashes, criteria, and oversized notes", () => {
    expect(() => parseAgentReviewRequest({
      proposalHash: "not-a-hash",
      decision: "accepted",
      criteria: [],
    })).toThrow("proposal hash");
    expect(() => parseAgentReviewRequest({
      proposalHash,
      decision: "approved",
      criteria: [{ criterion: "Tests pass", satisfied: true }],
    })).toThrow("decision");
    expect(() => parseAgentReviewRequest({
      proposalHash,
      decision: "rejected",
      criteria: [{ criterion: "Tests pass", satisfied: "no" }],
    })).toThrow("criterion decision");
    expect(() => parseAgentReviewRequest({
      proposalHash,
      decision: "rejected",
      criteria: [{ criterion: "Tests pass", satisfied: false }],
      note: "x".repeat(2_001),
    })).toThrow("note");
  });

  it("requires every frozen criterion before acceptance while always allowing rejection", () => {
    expect(reviewDecisionAvailability([
      { criterion: "Tests pass", satisfied: true },
      { criterion: "No regression", satisfied: false },
    ])).toEqual({ canAccept: false, canReject: true });
    expect(reviewDecisionAvailability([
      { criterion: "Tests pass", satisfied: true },
      { criterion: "No regression", satisfied: true },
    ])).toEqual({ canAccept: true, canReject: true });
  });
});

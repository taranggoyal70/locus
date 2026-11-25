import { describe, expect, it } from "vitest";

import {
  parseAgentReviewRequest,
  proposalPatchAvailable,
  reviewDecisionAvailability,
} from "@/lib/agent/run-review";

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

describe("proposal patch availability", () => {
  const proposal_hash = "a".repeat(64);
  const accepted = { decision: "accepted", proposal_hash };

  it("offers a proposal under Review, and one whose Review accepted it", () => {
    expect(proposalPatchAvailable({ status: "awaiting_approval", proposal_hash }, [])).toBe(true);
    expect(proposalPatchAvailable({ status: "completed", proposal_hash }, [accepted])).toBe(true);
  });

  it.each([
    ["no proposal", { status: "awaiting_approval", proposal_hash: null }, []],
    ["a Run still executing", { status: "executing", proposal_hash }, []],
    ["a rejected proposal", { status: "rejected", proposal_hash }, [{ decision: "rejected", proposal_hash }]],
    ["a failed Run", { status: "failed", proposal_hash }, [accepted]],
    ["completion without a Review", { status: "completed", proposal_hash }, []],
    ["a Review of another proposal", { status: "completed", proposal_hash }, [{ decision: "accepted", proposal_hash: "b".repeat(64) }]],
  ])("refuses %s", (_name, run, reviews) => {
    expect(proposalPatchAvailable(run, reviews)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import {
  assertRunTransition,
  canTransitionRun,
  isActiveRun,
  isTerminalRun,
  savingsClaimForRun,
} from "@/lib/agent/run-state";

describe("Run lifecycle", () => {
  it("allows only the forward lifecycle and explicit terminal exits", () => {
    expect(canTransitionRun("queued", "localizing")).toBe(true);
    expect(canTransitionRun("executing", "verifying")).toBe(true);
    expect(canTransitionRun("verifying", "failed")).toBe(true);
    expect(canTransitionRun("awaiting_approval", "cancelled")).toBe(true);
    expect(canTransitionRun("planning", "completed")).toBe(false);
  });

  it("keeps every terminal Run immutable", () => {
    for (const status of ["completed", "failed", "cancelled"] as const) {
      expect(isTerminalRun(status)).toBe(true);
      expect(() => assertRunTransition(status, "localizing")).toThrow(
        `Invalid Run transition: ${status} → localizing`,
      );
    }
  });

  it("treats human review as quiescent without making it terminal", () => {
    expect(isActiveRun("verifying")).toBe(true);
    expect(isActiveRun("awaiting_approval")).toBe(false);
    expect(isTerminalRun("awaiting_approval")).toBe(false);
  });
});

describe("verified savings claim", () => {
  const ledger = { contextTokensSaved: 7_500, contextReductionPercent: 75 };

  it("does not claim savings before a verified outcome", () => {
    expect(savingsClaimForRun("executing", ledger)).toEqual({
      verified: false,
      savedTokens: null,
      savedPct: null,
    });
    expect(savingsClaimForRun("failed", ledger)).toEqual({
      verified: false,
      savedTokens: null,
      savedPct: null,
    });
  });

  it("requires paired acceptance evidence even after completion", () => {
    expect(savingsClaimForRun("completed", ledger)).toEqual({
      verified: false,
      savedTokens: null,
      savedPct: null,
    });
    expect(savingsClaimForRun("completed", ledger, {
      acceptanceCriteriaSatisfied: true,
      pairedWholeRepoBaselineSatisfied: true,
    })).toEqual({
      verified: true,
      savedTokens: 7_500,
      savedPct: 75,
    });
  });
});

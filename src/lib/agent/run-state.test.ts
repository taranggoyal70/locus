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
    for (const status of ["completed", "rejected", "failed", "cancelled"] as const) {
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
  const ledger = { totalTokens: 4_000 };

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
      pairedWholeRepoBaseline: { acceptanceCriteriaSatisfied: true, totalTokens: 10_000 },
    })).toEqual({
      verified: true,
      savedTokens: 6_000,
      savedPct: 60,
    });
  });

  it("never turns context reduction or a rejected baseline into a whole-task claim", () => {
    expect(savingsClaimForRun("completed", ledger, {
      acceptanceCriteriaSatisfied: true,
      pairedWholeRepoBaseline: { acceptanceCriteriaSatisfied: false, totalTokens: 10_000 },
    })).toEqual({ verified: false, savedTokens: null, savedPct: null });
    expect(savingsClaimForRun("completed", { totalTokens: 12_000 }, {
      acceptanceCriteriaSatisfied: true,
      pairedWholeRepoBaseline: { acceptanceCriteriaSatisfied: true, totalTokens: 10_000 },
    })).toEqual({ verified: false, savedTokens: null, savedPct: null });
  });
});

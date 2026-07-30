import { describe, expect, it } from "vitest";

import {
  summarizeTokenUsage,
  transitionRun,
  type AgentRunEvent,
  type AgentRunStatus,
} from "@/lib/agent/run-state";

describe("agent run state", () => {
  it("moves a coding task through the verified delivery lifecycle", () => {
    const events: AgentRunEvent[] = [
      "start",
      "localized",
      "planned",
      "code_changed",
      "verified",
      "approved",
    ];
    const expected: AgentRunStatus[] = [
      "localizing",
      "planning",
      "executing",
      "verifying",
      "awaiting_approval",
      "completed",
    ];

    let status: AgentRunStatus = "queued";
    for (const [index, event] of events.entries()) {
      status = transitionRun(status, event);
      expect(status).toBe(expected[index]);
    }
  });

  it("rejects transitions that skip verification or approval", () => {
    expect(() => transitionRun("executing", "approved")).toThrow(
      "Cannot apply approved while run is executing",
    );
    expect(() => transitionRun("awaiting_approval", "code_changed")).toThrow(
      "Cannot apply code_changed while run is awaiting_approval",
    );
  });

  it("can cancel active work but never rewrites a terminal result", () => {
    expect(transitionRun("planning", "cancel")).toBe("cancelled");
    expect(() => transitionRun("completed", "cancel")).toThrow(
      "Cannot apply cancel while run is completed",
    );
  });
});

describe("agent token ledger", () => {
  it("reports end-to-end savings against a full-context baseline", () => {
    expect(
      summarizeTokenUsage({
        baselineTokens: 10_000,
        inputTokens: 3_000,
        outputTokens: 1_000,
        cachedInputTokens: 500,
      }),
    ).toEqual({
      baselineTokens: 10_000,
      inputTokens: 3_000,
      outputTokens: 1_000,
      cachedInputTokens: 500,
      totalTokens: 4_000,
      savedTokens: 6_000,
      savedPct: 60,
    });
  });

  it("never claims savings when a run exceeds its baseline", () => {
    expect(
      summarizeTokenUsage({
        baselineTokens: 1_000,
        inputTokens: 900,
        outputTokens: 300,
        cachedInputTokens: 0,
      }).savedPct,
    ).toBe(0);
  });
});

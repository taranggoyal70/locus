import { describe, expect, it } from "vitest";

import { runQuotaForTier } from "@/lib/admission";
import { agentRunQuotaDecision, quotaDenialMessage } from "@/lib/agent/run-quota";

const partner = runQuotaForTier("partner");
const free = runQuotaForTier("free");

describe("agent run quota", () => {
  it("allows bounded usage inside the tier's allowance", () => {
    expect(agentRunQuotaDecision({ activeRuns: 1, dailyRuns: 9, quota: partner })).toEqual({
      allowed: true,
    });
  });

  it("blocks concurrent and daily cost exhaustion", () => {
    expect(agentRunQuotaDecision({ activeRuns: 2, dailyRuns: 2, quota: partner })).toMatchObject({
      allowed: false,
      reason: "active",
    });
    expect(agentRunQuotaDecision({ activeRuns: 0, dailyRuns: 10, quota: partner })).toMatchObject({
      allowed: false,
      reason: "daily",
    });
  });

  it("holds a free account to its smaller allowance at the same counts", () => {
    // The same usage that a partner may continue from is already exhausted for a
    // free account. This is the whole reason the limits became an argument.
    expect(agentRunQuotaDecision({ activeRuns: 1, dailyRuns: 0, quota: free })).toMatchObject({
      allowed: false,
      reason: "active",
    });
    expect(agentRunQuotaDecision({ activeRuns: 0, dailyRuns: 3, quota: free })).toMatchObject({
      allowed: false,
      reason: "daily",
    });
    expect(agentRunQuotaDecision({ activeRuns: 0, dailyRuns: 2, quota: free })).toEqual({
      allowed: true,
    });
  });

  it("refuses every Run for a tier with no allowance", () => {
    const visitor = runQuotaForTier("visitor");
    expect(agentRunQuotaDecision({ activeRuns: 0, dailyRuns: 0, quota: visitor })).toMatchObject({
      allowed: false,
      reason: "active",
    });
  });

  it("states the limit the account actually has, not a hard-coded one", () => {
    expect(quotaDenialMessage("active", free)).toBe(
      "An agent run is already active. Wait for it to finish.",
    );
    expect(quotaDenialMessage("active", partner)).toBe(
      "2 agent runs are already active. Wait for one to finish.",
    );
    expect(quotaDenialMessage("active", runQuotaForTier("pro"))).toContain("5 agent runs");
    expect(quotaDenialMessage("daily", free)).toBe(
      "Daily Agent Run quota reached (3). Try again tomorrow.",
    );
  });
});

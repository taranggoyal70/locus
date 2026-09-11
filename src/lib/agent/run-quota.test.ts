import { describe, expect, it } from "vitest";

import { runQuotaForTier } from "@/lib/admission";
import {
  agentRunQuotaDecision,
  quotaDenialMessage,
  quotaReasonFromClaim,
} from "@/lib/agent/run-quota";

const partner = runQuotaForTier("partner");
const free = runQuotaForTier("free");

describe("agent run quota", () => {
  it("allows bounded usage inside the tier's allowance", () => {
    expect(agentRunQuotaDecision({ activeRuns: 1, runsInLast24Hours: 9, quota: partner })).toEqual({
      allowed: true,
    });
  });

  it("blocks concurrent and daily cost exhaustion", () => {
    expect(agentRunQuotaDecision({ activeRuns: 2, runsInLast24Hours: 2, quota: partner })).toMatchObject({
      allowed: false,
      reason: "active",
    });
    expect(agentRunQuotaDecision({ activeRuns: 0, runsInLast24Hours: 10, quota: partner })).toMatchObject({
      allowed: false,
      reason: "rolling_24_hours",
    });
  });

  it("holds a free account to its smaller allowance at the same counts", () => {
    // The same usage that a partner may continue from is already exhausted for a
    // free account. This is the whole reason the limits became an argument.
    expect(agentRunQuotaDecision({ activeRuns: 1, runsInLast24Hours: 0, quota: free })).toMatchObject({
      allowed: false,
      reason: "active",
    });
    expect(agentRunQuotaDecision({ activeRuns: 0, runsInLast24Hours: 2, quota: free })).toMatchObject({
      allowed: false,
      reason: "rolling_24_hours",
    });
    expect(agentRunQuotaDecision({ activeRuns: 0, runsInLast24Hours: 1, quota: free })).toEqual({
      allowed: true,
    });
  });

  it("refuses every Run for a tier with no allowance", () => {
    const visitor = runQuotaForTier("visitor");
    expect(agentRunQuotaDecision({ activeRuns: 0, runsInLast24Hours: 0, quota: visitor })).toMatchObject({
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
    expect(quotaDenialMessage("rolling_24_hours", free)).toBe(
      "Agent Run quota reached (2 per rolling 24 hours). A slot opens when your oldest Run ages out.",
    );
  });

  it("translates the database's legacy daily reason only at the claim boundary", () => {
    expect(quotaReasonFromClaim("daily")).toBe("rolling_24_hours");
    expect(quotaReasonFromClaim("active")).toBe("active");
    expect(quotaReasonFromClaim("unknown")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import { agentRunQuotaDecision } from "@/lib/agent/run-quota";

describe("agent run quota", () => {
  it("allows bounded public-beta usage", () => {
    expect(agentRunQuotaDecision({ activeRuns: 1, dailyRuns: 9 })).toEqual({ allowed: true });
  });

  it("blocks concurrent and daily cost exhaustion", () => {
    expect(agentRunQuotaDecision({ activeRuns: 2, dailyRuns: 2 })).toMatchObject({
      allowed: false,
      reason: "active",
    });
    expect(agentRunQuotaDecision({ activeRuns: 0, dailyRuns: 10 })).toMatchObject({
      allowed: false,
      reason: "daily",
    });
  });
});

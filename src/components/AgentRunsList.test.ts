import { describe, expect, it } from "vitest";

import { alphaRunStatusLabel, runUsageLabel } from "@/components/AgentRunsList";

describe("controlled-alpha Run ledger labels", () => {
  it("describes review and token usage without a savings claim", () => {
    expect(alphaRunStatusLabel("awaiting_approval")).toBe("ready for review");
    expect(runUsageLabel(12_345)).toBe("12,345 tokens used");
  });
});

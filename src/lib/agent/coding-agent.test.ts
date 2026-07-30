import { describe, expect, it } from "vitest";

import {
  calculateTokenLedger,
  resolveAgentModel,
} from "@/lib/agent/coding-agent";

describe("coding agent configuration", () => {
  it("uses the current coding model unless a deployment overrides it", () => {
    expect(resolveAgentModel({})).toBe("openai/gpt-5.6-sol");
    expect(resolveAgentModel({ LOCUS_AGENT_MODEL: "openai/gpt-5.6-terra" })).toBe(
      "openai/gpt-5.6-terra",
    );
  });

  it("reports Slice savings separately from actual model usage", () => {
    expect(
      calculateTokenLedger({
        baselineContextTokens: 10_000,
        includedContextTokens: 2_500,
        inputTokens: 3_100,
        outputTokens: 900,
      }),
    ).toEqual({
      baselineContextTokens: 10_000,
      includedContextTokens: 2_500,
      contextTokensSaved: 7_500,
      contextReductionPercent: 75,
      inputTokens: 3_100,
      outputTokens: 900,
      totalTokens: 4_000,
    });
  });

  it("never reports negative context savings", () => {
    expect(
      calculateTokenLedger({
        baselineContextTokens: 100,
        includedContextTokens: 140,
        inputTokens: undefined,
        outputTokens: undefined,
      }),
    ).toMatchObject({
      contextTokensSaved: 0,
      contextReductionPercent: 0,
      inputTokens: 0,
      outputTokens: 0,
    });
  });
});

import { describe, expect, it } from "vitest";

import { controlledAlphaTokenView } from "@/lib/agent/run-view";

describe("controlled-alpha Run evidence token view", () => {
  it("returns factual usage without any Savings claim fields", () => {
    expect(controlledAlphaTokenView({
      baselineContextTokens: 10_000,
      includedContextTokens: 2_500,
      inputTokens: 1_200,
      cachedInputTokens: 400,
      outputTokens: 300,
      totalTokens: 1_500,
    })).toEqual({
      baselineTokens: 10_000,
      includedContextTokens: 2_500,
      inputTokens: 1_200,
      cachedInputTokens: 400,
      outputTokens: 300,
      totalTokens: 1_500,
    });
  });
});

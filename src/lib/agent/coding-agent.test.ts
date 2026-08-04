import { describe, expect, it } from "vitest";

import {
  AGENT_MAX_STEPS,
  agentStepBudgetSettings,
  calculateTokenLedger,
  resolveAgentLanguageModel,
  resolveAgentModel,
} from "@/lib/agent/coding-agent";

describe("coding agent configuration", () => {
  it("caps the agent loop at the frozen Release 1 limit", () => {
    expect(AGENT_MAX_STEPS).toBe(10);
  });

  it("uses the current coding model unless a deployment overrides it", () => {
    expect(resolveAgentModel({})).toBe("openai/gpt-5.6-sol");
    expect(resolveAgentModel({ LOCUS_AGENT_MODEL: "openai/gpt-5.6-terra" })).toBe(
      "openai/gpt-5.6-terra",
    );
  });

  it("routes an explicitly configured Google model directly on the free tier", () => {
    const model = resolveAgentLanguageModel("google/gemini-3.5-flash", {
      GOOGLE_GENERATIVE_AI_API_KEY: "test-google-key",
    });

    expect(model).toMatchObject({
      modelId: "gemini-3.5-flash",
      provider: "google.generative-ai",
    });
  });

  it("keeps Gateway routing when no direct-provider credential is configured", () => {
    expect(resolveAgentLanguageModel("google/gemini-3.5-flash", {})).toBe(
      "google/gemini-3.5-flash",
    );
  });

  it("fails closed when a Google credential is paired with another provider", () => {
    expect(() => resolveAgentLanguageModel("openai/gpt-5.6-sol", {
      GOOGLE_GENERATIVE_AI_API_KEY: "test-google-key",
    })).toThrow("requires LOCUS_AGENT_MODEL to use the google/<model> format");
  });

  it("reports Slice savings separately from actual model usage", () => {
    expect(
      calculateTokenLedger({
        baselineContextTokens: 10_000,
        includedContextTokens: 2_500,
        inputTokens: 3_100,
        cachedInputTokens: 1_200,
        outputTokens: 900,
      }),
    ).toEqual({
      baselineContextTokens: 10_000,
      includedContextTokens: 2_500,
      contextTokensSaved: 7_500,
      contextReductionPercent: 75,
      inputTokens: 3_100,
      cachedInputTokens: 1_200,
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
      cachedInputTokens: 0,
      outputTokens: 0,
    });
  });

  it("refuses another model step when its estimated request would cross the Run budget", () => {
    const priorUsages = [
      { totalTokens: 70_000 },
      { totalTokens: 80_000 },
    ];

    expect(agentStepBudgetSettings({
      budgetTokens: 180_000,
      messages: "x".repeat(80_000),
      priorUsages,
    })).toEqual({ maxOutputTokens: 6_000 });

    expect(() => agentStepBudgetSettings({
      budgetTokens: 180_000,
      messages: "x".repeat(120_000),
      priorUsages,
    })).toThrow("Run token budget exhausted");
  });
});

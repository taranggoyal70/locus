import { describe, expect, it } from "vitest";
import { MockLanguageModelV4 } from "ai/test";

import {
  AGENT_MAX_STEPS,
  ALLOWED_AGENT_MODELS,
  CodingAgentTimeoutError,
  DisallowedAgentModelError,
  agentStepBudgetSettings,
  calculateTokenLedger,
  resolveAgentLanguageModel,
  resolveAgentModel,
  runCodingTask,
} from "@/lib/agent/coding-agent";
import type { WorkspaceController } from "@/lib/agent/workspace";

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

  // R14: an override is honoured only within the allowlist. Otherwise a single
  // environment variable stands between an operator mistake and Run content
  // reaching a provider under an unreviewed data policy.
  it.each([
    "anthropic/claude-opus-4",
    "openai/gpt-4o",
    "google/gemini-1.0-pro",
    "http://attacker.example/model",
  ])("refuses a model outside the production allowlist: %s", (model) => {
    expect(() => resolveAgentModel({ LOCUS_AGENT_MODEL: model })).toThrow(
      DisallowedAgentModelError,
    );
  });

  it("names the permitted models when it refuses", () => {
    expect(() => resolveAgentModel({ LOCUS_AGENT_MODEL: "openai/gpt-4o" })).toThrow(
      /Permitted models: openai\/gpt-5\.6-sol/,
    );
  });

  // Trimming surrounding whitespace is correct handling of an environment
  // variable, not a way around the allowlist.
  it("tolerates whitespace around an allowlisted model", () => {
    expect(resolveAgentModel({ LOCUS_AGENT_MODEL: "  openai/gpt-5.6-sol  " })).toBe(
      "openai/gpt-5.6-sol",
    );
  });

  it("allows every model on the allowlist", () => {
    for (const model of ALLOWED_AGENT_MODELS) {
      expect(resolveAgentModel({ LOCUS_AGENT_MODEL: model })).toBe(model);
    }
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

  it("aborts a provider call that never returns", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async ({ abortSignal }) =>
        await new Promise<never>((_resolve, reject) => {
          abortSignal?.addEventListener(
            "abort",
            () => reject(abortSignal.reason),
            { once: true },
          );
        }),
    });

    await expect(runCodingTask({
      prompt: "Make a small change",
      controller: {} as WorkspaceController,
      baselineContextTokens: 100,
      includedContextTokens: 10,
      model,
      timeouts: {
        totalMs: 100,
        stepMs: 20,
        toolMs: 50,
        tools: { run_checksMs: 80 },
      },
    })).rejects.toBeInstanceOf(CodingAgentTimeoutError);
  });
});

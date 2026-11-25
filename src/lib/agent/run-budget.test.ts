import { describe, expect, it } from "vitest";

import { IncompleteRepositoryError } from "@/lib/agent/github-source";
import {
  AGENT_STOPPED,
  RunBudgetExceededError,
  agentFailureMessage,
  assertWithinRunTokenBudget,
  classifyAgentFailure,
  nextStepBudgetDecision,
  resolveRunTokenBudget,
} from "@/lib/agent/run-budget";

describe("agent Run token budget", () => {
  it("uses a conservative default and accepts an explicit bounded override", () => {
    expect(resolveRunTokenBudget({})).toBe(180_000);
    expect(resolveRunTokenBudget({ LOCUS_RUN_TOKEN_BUDGET: "120000" })).toBe(120_000);
  });

  it("fails closed for malformed or unsafe deployment configuration", () => {
    expect(() => resolveRunTokenBudget({ LOCUS_RUN_TOKEN_BUDGET: "free" })).toThrow(
      "LOCUS_RUN_TOKEN_BUDGET",
    );
    expect(() => resolveRunTokenBudget({ LOCUS_RUN_TOKEN_BUDGET: "9000" })).toThrow(
      "between 10000 and 240000",
    );
    expect(() => resolveRunTokenBudget({ LOCUS_RUN_TOKEN_BUDGET: "240001" })).toThrow(
      "between 10000 and 240000",
    );
  });

  it("bounds the next response before another provider request is made", () => {
    expect(nextStepBudgetDecision({
      budgetTokens: 180_000,
      consumedTokens: 120_000,
      estimatedInputTokens: 52_000,
      requestedOutputTokens: 6_000,
    })).toEqual({ allowed: true, maxOutputTokens: 6_000, remainingTokens: 8_000 });

    expect(() => nextStepBudgetDecision({
      budgetTokens: 180_000,
      consumedTokens: 120_000,
      estimatedInputTokens: 59_500,
      requestedOutputTokens: 6_000,
    })).toThrow(RunBudgetExceededError);
  });

  it("rejects a completed provider response whose measured usage exceeded the Run budget", () => {
    expect(() => assertWithinRunTokenBudget({
      budgetTokens: 180_000,
      inputTokens: 175_000,
      outputTokens: 5_001,
    })).toThrow(RunBudgetExceededError);

    expect(() => assertWithinRunTokenBudget({
      budgetTokens: 180_000,
      inputTokens: 175_000,
      outputTokens: 5_000,
    })).not.toThrow();
  });

  it("distinguishes local budget exhaustion from provider quota exhaustion", () => {
    expect(classifyAgentFailure(new RunBudgetExceededError(180_000, 179_500))).toBe(
      "token_budget_exhausted",
    );
    expect(classifyAgentFailure(new Error("429 RESOURCE_EXHAUSTED: quota exceeded"))).toBe(
      "quota_exhausted",
    );
    expect(classifyAgentFailure(new Error("Verification failed: pnpm test"))).toBe(
      "verification_error",
    );
    expect(classifyAgentFailure(new Error("Sandbox stopped unexpectedly"))).toBe(
      "sandbox_error",
    );
    const codingAgentTimeout = new Error("Coding Agent execution exceeded its deadline");
    codingAgentTimeout.name = "CodingAgentTimeoutError";
    expect(classifyAgentFailure(codingAgentTimeout)).toBe("provider_error");
    expect(classifyAgentFailure(new Error(
      "FatalError: executeRunStep failed: Coding Agent execution exceeded its deadline.",
    ))).toBe("provider_error");
    expect(classifyAgentFailure(new Error(
      "AI_NoOutputGeneratedError: No output generated.",
    ))).toBe("provider_error");
    expect(classifyAgentFailure(new Error("Unknown failure"))).toBe("workflow_error");
  });

  it("shows actionable failure copy without leaking provider payloads", () => {
    expect(agentFailureMessage("quota_exhausted", "shared")).toContain(
      "shared Cloudflare Workers AI capacity",
    );
    expect(agentFailureMessage("quota_exhausted", "shared")).toContain("UTC reset");
    expect(agentFailureMessage("quota_exhausted", "byok")).toMatch(/your Cloudflare account/i);
    expect(agentFailureMessage("provider_error", "byok")).toContain("Cloudflare Workers AI");
    expect(agentFailureMessage("token_budget_exhausted")).toContain("token budget");
    expect(agentFailureMessage("provider_error")).not.toContain("API key");
  });
});

describe("failures Locus caused knowingly", () => {
  // What the workflow catches: a durable step keeps the message, not the class.
  const wrapped = (message: string) => new Error(
    `Step "step//./src/workflows/agent-run//executeRunStep" failed after 0 retries: ${message}`,
  );

  it.each([
    ["noChanges", "workflow_error"],
    ["noCheckRun", "verification_error"],
    ["noChecksAvailable", "verification_error"],
  ] as const)("says what happened for %s", (name, kind) => {
    const error = wrapped(AGENT_STOPPED[name]);
    expect(classifyAgentFailure(error)).toBe(kind);
    expect(agentFailureMessage(kind, "shared", error)).toBe(AGENT_STOPPED[name]);
  });

  it("names the check that failed on the frozen candidate", () => {
    const error = wrapped("Verification failed against the frozen candidate: pnpm test, pnpm lint");
    expect(classifyAgentFailure(error)).toBe("verification_error");
    expect(agentFailureMessage("verification_error", "shared", error)).toBe(
      "The proposed change failed pnpm test, pnpm lint when it was repeated in a clean workspace, so nothing was published.",
    );
  });

  it("keeps the incomplete-repository message through the step wrapper", () => {
    const incomplete = new IncompleteRepositoryError("octo/large");
    expect(agentFailureMessage("workflow_error", "shared", wrapped(incomplete.message)))
      .toBe(incomplete.message);
  });

  it("leaves every other failure to its generic text", () => {
    expect(agentFailureMessage("provider_error", "shared", wrapped("secret detail")))
      .toBe(agentFailureMessage("provider_error", "shared"));
  });
});

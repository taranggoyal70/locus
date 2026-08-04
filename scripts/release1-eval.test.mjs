import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { evaluateRelease1Results } from "./release1-eval.mjs";

const contract = {
  version: "release1-v1",
  model: { id: "frozen-model" },
  promptVersion: "frozen-prompt",
  toolsVersion: "frozen-tools",
  cases: ["a", "b", "c", "d"].map((id) => ({
    id,
    snapshotSha: id.repeat(40),
  })),
  thresholds: {
    minimumAcceptanceRate: 0.75,
    maximumAcceptanceRateGap: 0.25,
    minimumMedianTotalTokenReduction: 0.3,
    minimumPairsWithTokenReduction: 3,
    maximumCriticalRegressions: 0,
  },
};

function pair(caseId, sliceTokens, baselineTokens, sliceAccepted = true, baselineAccepted = true) {
  const caseNumber = caseId.charCodeAt(0) - 96;
  const evidence = (armNumber) => ({
    contractVersion: contract.version,
    snapshotSha: caseId.repeat(40),
    modelId: contract.model.id,
    promptVersion: contract.promptVersion,
    toolsVersion: contract.toolsVersion,
    runId: `00000000-0000-4000-8000-${String(caseNumber * 10 + armNumber).padStart(12, "0")}`,
    reviewId: `00000000-0000-4000-9000-${String(caseNumber * 10 + armNumber).padStart(12, "0")}`,
  });
  return [
    {
      caseId,
      arm: "slice",
      totalTokens: sliceTokens,
      accepted: sliceAccepted,
      criticalRegression: false,
      ...evidence(1),
      proposalHash: "a".repeat(64),
    },
    {
      caseId,
      arm: "whole_repo",
      totalTokens: baselineTokens,
      accepted: baselineAccepted,
      criticalRegression: false,
      ...evidence(2),
      proposalHash: "b".repeat(64),
    },
  ];
}

describe("Release 1 paired evaluation gate", () => {
  it("freezes 20 tasks across 5 repositories with immutable revisions", () => {
    const frozen = JSON.parse(readFileSync("benchmarks/release1/contract.json", "utf8"));
    expect(frozen.cases).toHaveLength(20);
    expect(new Set(frozen.cases.map((testCase) => testCase.repository))).toHaveLength(5);
    expect(frozen.cases.every((testCase) => /^[0-9a-f]{40}$/.test(testCase.snapshotSha))).toBe(true);
    expect(frozen.arms.map((arm) => arm.id)).toEqual(["slice", "whole_repo"]);
  });

  it("passes complete paired evidence with preserved quality and lower total tokens", () => {
    const results = [
      ...pair("a", 50, 100),
      ...pair("b", 60, 100),
      ...pair("c", 65, 100),
      ...pair("d", 70, 100),
    ];
    expect(evaluateRelease1Results(contract, results)).toMatchObject({
      passed: true,
      evidenceComplete: true,
      pairsWithTokenReduction: 4,
      medianTotalTokenReduction: 0.375,
    });
  });

  it("fails closed for missing arms, quality loss, or critical regressions", () => {
    const missing = pair("a", 50, 100);
    expect(evaluateRelease1Results(contract, missing)).toMatchObject({
      passed: false,
      evidenceComplete: false,
    });

    const results = [
      ...pair("a", 50, 100, false, true),
      ...pair("b", 50, 100, false, true),
      ...pair("c", 50, 100, false, true),
      ...pair("d", 50, 100, true, true),
    ];
    results[results.length - 1].criticalRegression = true;
    expect(evaluateRelease1Results(contract, results)).toMatchObject({ passed: false });
  });

  it("rejects evidence produced with a different frozen contract or repository snapshot", () => {
    const results = [
      ...pair("a", 50, 100),
      ...pair("b", 60, 100),
      ...pair("c", 65, 100),
      ...pair("d", 70, 100),
    ];
    results[0].snapshotSha = "f".repeat(40);
    results[1].modelId = "different-model";

    expect(evaluateRelease1Results(contract, results)).toMatchObject({
      passed: false,
      evidenceComplete: false,
    });
  });

  it("treats only Slice quality regressions as a quality gap", () => {
    const stricter = {
      ...contract,
      thresholds: { ...contract.thresholds, maximumAcceptanceRateGap: 0.05 },
    };
    const results = [
      ...pair("a", 50, 100, true, false),
      ...pair("b", 60, 100),
      ...pair("c", 65, 100),
      ...pair("d", 70, 100),
    ];
    expect(evaluateRelease1Results(stricter, results)).toMatchObject({
      passed: true,
      acceptanceRateGap: 0,
    });
  });
});

import { describe, expect, it } from "vitest";

import { buildRelease1PublicReport } from "./release1-public-report.mjs";

const contract = {
  version: "release1-v1",
  frozenAt: "2026-08-03T00:00:00.000Z",
  model: { id: "frozen-model" },
  promptVersion: "frozen-prompt",
  toolsVersion: "frozen-tools",
  arms: [{ id: "slice" }, { id: "whole_repo" }],
  review: { blinded: true },
  thresholds: {
    minimumAcceptanceRate: 0.8,
    maximumAcceptanceRateGap: 0.05,
    minimumMedianTotalTokenReduction: 0.3,
    minimumPairsWithTokenReduction: 1,
    maximumCriticalRegressions: 0,
  },
  cases: [{
    id: "case-a",
    repository: "https://github.com/example/repo",
    snapshotSha: "a".repeat(40),
  }],
};

function result(arm, armNumber, totalTokens) {
  return {
    caseId: "case-a",
    arm,
    totalTokens,
    accepted: true,
    criticalRegression: false,
    contractVersion: contract.version,
    snapshotSha: "a".repeat(40),
    modelId: contract.model.id,
    promptVersion: contract.promptVersion,
    toolsVersion: contract.toolsVersion,
    runId: `00000000-0000-4000-8000-${String(armNumber).padStart(12, "0")}`,
    reviewId: `00000000-0000-4000-9000-${String(armNumber).padStart(12, "0")}`,
    proposalHash: armNumber.toString().repeat(64),
  };
}

describe("Release 1 public evidence report", () => {
  it("withholds outcome metrics while evidence is incomplete", () => {
    expect(buildRelease1PublicReport(contract, [])).toMatchObject({
      status: "collecting",
      gatePassed: false,
      evidenceComplete: false,
      progress: { validResults: 0, expectedResults: 2 },
      metrics: null,
    });
  });

  it("publishes aggregate metrics only after all evidence is valid", () => {
    const report = buildRelease1PublicReport(contract, [
      result("slice", 1, 50),
      result("whole_repo", 2, 100),
    ]);

    expect(report).toMatchObject({
      status: "passed",
      gatePassed: true,
      evidenceComplete: true,
      metrics: { medianTotalTokenReduction: 0.5 },
    });
    expect(JSON.stringify(report)).not.toContain("runId");
    expect(JSON.stringify(report)).not.toContain("reviewId");
  });
});

import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function isValidResult(result, contract, testCase) {
  return result
    && typeof result === "object"
    && testCase
    && typeof result.caseId === "string"
    && (result.arm === "slice" || result.arm === "whole_repo")
    && Number.isInteger(result.totalTokens)
    && result.totalTokens > 0
    && typeof result.accepted === "boolean"
    && typeof result.criticalRegression === "boolean"
    && result.contractVersion === contract.version
    && result.snapshotSha === testCase.snapshotSha
    && result.modelId === contract.model?.id
    && result.promptVersion === contract.promptVersion
    && result.toolsVersion === contract.toolsVersion
    && typeof result.runId === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result.runId)
    && typeof result.reviewId === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result.reviewId)
    && typeof result.proposalHash === "string"
    && /^[0-9a-f]{64}$/.test(result.proposalHash);
}

export function evaluateRelease1Results(contract, results) {
  const declaredCases = Array.isArray(contract?.cases) ? contract.cases : [];
  const declaredCaseById = new Map(declaredCases.map((testCase) => [testCase.id, testCase]));
  const thresholds = contract?.thresholds ?? {};
  const validResults = Array.isArray(results)
    ? results.filter((result) => isValidResult(
      result,
      contract,
      declaredCaseById.get(result?.caseId),
    ))
    : [];
  const submittedResults = Array.isArray(results) ? results.length : 0;
  const indexed = new Map();
  const evidenceIds = new Set();
  let duplicates = 0;
  let duplicateEvidence = 0;
  for (const result of validResults) {
    const key = `${result.caseId}:${result.arm}`;
    if (indexed.has(key)) duplicates += 1;
    indexed.set(key, result);
    for (const evidenceId of [result.runId, result.reviewId]) {
      if (evidenceIds.has(evidenceId)) duplicateEvidence += 1;
      evidenceIds.add(evidenceId);
    }
  }

  let completePairs = 0;
  let pairsWithTokenReduction = 0;
  let sliceAccepted = 0;
  let baselineAccepted = 0;
  let criticalRegressions = 0;
  const reductions = [];

  for (const testCase of declaredCases) {
    const slice = indexed.get(`${testCase.id}:slice`);
    const baseline = indexed.get(`${testCase.id}:whole_repo`);
    if (slice) {
      if (slice.accepted) sliceAccepted += 1;
      if (slice.criticalRegression) criticalRegressions += 1;
    }
    if (baseline) {
      if (baseline.accepted) baselineAccepted += 1;
      if (baseline.criticalRegression) criticalRegressions += 1;
    }
    if (!slice || !baseline) {
      reductions.push(0);
      continue;
    }
    completePairs += 1;
    const reduction = slice.accepted && baseline.accepted
      ? (baseline.totalTokens - slice.totalTokens) / baseline.totalTokens
      : 0;
    reductions.push(reduction);
    if (reduction > 0) pairsWithTokenReduction += 1;
  }

  const caseCount = declaredCases.length;
  const expectedResults = caseCount * 2;
  const evidenceComplete = caseCount > 0
    && completePairs === caseCount
    && validResults.length === expectedResults
    && duplicates === 0
    && duplicateEvidence === 0;
  const sliceAcceptanceRate = caseCount === 0 ? 0 : sliceAccepted / caseCount;
  const baselineAcceptanceRate = caseCount === 0 ? 0 : baselineAccepted / caseCount;
  const acceptanceRateGap = Math.max(0, baselineAcceptanceRate - sliceAcceptanceRate);
  const medianTotalTokenReduction = median(reductions);
  const gates = {
    evidenceComplete,
    minimumAcceptanceRate:
      sliceAcceptanceRate >= thresholds.minimumAcceptanceRate
      && baselineAcceptanceRate >= thresholds.minimumAcceptanceRate,
    maximumAcceptanceRateGap: acceptanceRateGap <= thresholds.maximumAcceptanceRateGap,
    minimumMedianTotalTokenReduction:
      medianTotalTokenReduction >= thresholds.minimumMedianTotalTokenReduction,
    minimumPairsWithTokenReduction:
      pairsWithTokenReduction >= thresholds.minimumPairsWithTokenReduction,
    maximumCriticalRegressions:
      criticalRegressions <= thresholds.maximumCriticalRegressions,
  };

  return {
    version: contract?.version ?? null,
    passed: Object.values(gates).every(Boolean),
    status: evidenceComplete ? "evaluated" : "collecting",
    evidenceComplete,
    submittedResults,
    validResults: validResults.length,
    invalidResults: submittedResults - validResults.length,
    expectedResults,
    completePairs,
    expectedPairs: caseCount,
    sliceAcceptanceRate,
    baselineAcceptanceRate,
    acceptanceRateGap,
    medianTotalTokenReduction,
    pairsWithTokenReduction,
    criticalRegressions,
    gates,
  };
}

function main() {
  const contractPath = "benchmarks/release1/contract.json";
  const resultsPath = process.argv[2] ?? "benchmarks/release1/results.json";
  const contract = JSON.parse(readFileSync(contractPath, "utf8"));
  const results = existsSync(resultsPath) ? JSON.parse(readFileSync(resultsPath, "utf8")) : [];
  const report = evaluateRelease1Results(contract, results);
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}

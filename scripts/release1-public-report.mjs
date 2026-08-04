import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { evaluateRelease1Results } from "./release1-eval.mjs";

const contractPath = "benchmarks/release1/contract.json";
const resultsPath = "benchmarks/release1/results.json";
const reportPath = "benchmarks/release1/public-report.json";

export function buildRelease1PublicReport(contract, results) {
  const evaluation = evaluateRelease1Results(contract, results);
  const repositories = [...new Set(contract.cases.map((testCase) => testCase.repository))];
  const metrics = evaluation.evidenceComplete
    ? {
        sliceAcceptanceRate: evaluation.sliceAcceptanceRate,
        baselineAcceptanceRate: evaluation.baselineAcceptanceRate,
        acceptanceRateGap: evaluation.acceptanceRateGap,
        medianTotalTokenReduction: evaluation.medianTotalTokenReduction,
        pairsWithTokenReduction: evaluation.pairsWithTokenReduction,
        criticalRegressions: evaluation.criticalRegressions,
      }
    : null;

  return {
    schemaVersion: 1,
    contractVersion: contract.version,
    contractFrozenAt: contract.frozenAt,
    status: evaluation.evidenceComplete
      ? evaluation.passed ? "passed" : "failed"
      : "collecting",
    gatePassed: evaluation.passed,
    evidenceComplete: evaluation.evidenceComplete,
    progress: {
      submittedResults: evaluation.submittedResults,
      validResults: evaluation.validResults,
      invalidResults: evaluation.invalidResults,
      expectedResults: evaluation.expectedResults,
      completePairs: evaluation.completePairs,
      expectedPairs: evaluation.expectedPairs,
    },
    study: {
      repositoryCount: repositories.length,
      caseCount: contract.cases.length,
      armCount: contract.arms.length,
      modelId: contract.model.id,
      promptVersion: contract.promptVersion,
      toolsVersion: contract.toolsVersion,
      blindedReview: contract.review.blinded,
    },
    thresholds: contract.thresholds,
    metrics,
  };
}

function serialize(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function main() {
  const contract = JSON.parse(readFileSync(contractPath, "utf8"));
  const results = existsSync(resultsPath) ? JSON.parse(readFileSync(resultsPath, "utf8")) : [];
  const nextReport = serialize(buildRelease1PublicReport(contract, results));

  if (process.argv.includes("--write")) {
    writeFileSync(reportPath, nextReport);
    console.log(`Wrote ${reportPath}`);
    return;
  }

  const currentReport = existsSync(reportPath) ? readFileSync(reportPath, "utf8") : "";
  if (currentReport !== nextReport) {
    console.error(`${reportPath} is stale. Run pnpm evidence:release1:write.`);
    process.exitCode = 1;
    return;
  }

  console.log(`${reportPath} matches the frozen contract and checked-in results.`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}

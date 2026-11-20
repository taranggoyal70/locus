import type { Metadata } from "next";

import contract from "../../../../benchmarks/release1/contract.json";
import report from "../../../../benchmarks/release1/public-report.json";
import { MarketingShell } from "@/components/MarketingShell";
import { selfServeOpen } from "@/lib/admission";
import { REPO_URL } from "@/lib/config";
import { RiseWords } from "@/components/Reveal";

export const metadata: Metadata = {
  title: "Release 1 evidence · Locus",
  description: "The frozen, fail-closed protocol and current evidence state for Locus Release 1.",
};

type AggregateMetrics = {
  sliceAcceptanceRate: number;
  baselineAcceptanceRate: number;
  acceptanceRateGap: number;
  medianTotalTokenReduction: number;
  pairsWithTokenReduction: number;
  criticalRegressions: number;
};

type PublicReport = Omit<typeof report, "metrics"> & { metrics: AggregateMetrics | null };

const evidence = report as PublicReport;
const evidenceBase = `${REPO_URL}/blob/main/benchmarks/release1`;

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function repoName(repository: string) {
  return repository.replace("https://github.com/", "");
}

export default function Release1EvidencePage() {
  const completion = evidence.progress.expectedResults === 0
    ? 0
    : evidence.progress.validResults / evidence.progress.expectedResults;

  return (
    <MarketingShell selfServeOpen={selfServeOpen()}>
      <main className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-20">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-muted">
              Release 1 / public evidence
            </p>
            <RiseWords as="h1" onLoad lines={["The claim stays locked until the evidence is complete."]} className="mt-4 font-display text-4xl font-semibold tracking-[-0.04em] text-ink sm:text-6xl" />
            <p className="mt-5 max-w-2xl text-base leading-7 text-ink-2">
              Twenty historical engineering tasks, two context arms, one frozen protocol. Human
              reviewers decide correctness without seeing which arm produced the proposal. Missing,
              rejected, duplicated, or mismatched evidence cannot pass the gate.
            </p>
          </div>
          <div className="w-full rounded-card border border-line-2 bg-surface p-5 shadow-panel lg:max-w-xs">
            <div className="flex items-center justify-between gap-4">
              <span className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                Gate status
              </span>
              <span className="rounded-full border border-widened/30 bg-widened/10 px-3 py-1 text-xs font-semibold text-widened">
                {evidence.gatePassed ? "Passed" : "Locked"}
              </span>
            </div>
            <p className="mt-5 tabular text-4xl font-semibold tracking-[-0.04em] text-ink">
              {evidence.progress.validResults}<span className="text-xl text-muted">/{evidence.progress.expectedResults}</span>
            </p>
            <p className="mt-1 text-sm text-ink-2">valid reviewed arm results</p>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-surface-2" aria-label={`${percent(completion)} complete`}>
              <div className="h-full rounded-full bg-included" style={{ width: percent(completion) }} />
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-line" />

        <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Study summary">
          {[
            ["Frozen tasks", String(evidence.study.caseCount)],
            ["Public repositories", String(evidence.study.repositoryCount)],
            ["Complete pairs", `${evidence.progress.completePairs}/${evidence.progress.expectedPairs}`],
            ["Review", evidence.study.blindedReview ? "Arm-blinded" : "Not blinded"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-card border border-line-2 bg-surface/75 p-5">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</p>
              <p className="mt-3 text-xl font-semibold tracking-[-0.03em] text-ink">{value}</p>
            </div>
          ))}
        </section>

        <section className="mt-14 grid gap-8 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-muted">Protocol</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-ink">Same task. Same limits. Different context.</h2>
            <ol className="mt-7 space-y-4">
              {[
                ["01", "Freeze", "Repository snapshot, model, prompt, tools, token budget, and review rubric are immutable."],
                ["02", "Pair", "Each task runs once with the Locus Slice and once with every supported source file."],
                ["03", "Blind review", "Criterion-level human review happens before the arm and token usage are revealed."],
                ["04", "Fail closed", "Only complete, accepted pairs contribute a token reduction. Critical regressions fail the study."],
              ].map(([number, title, description]) => (
                <li key={number} className="grid grid-cols-[2.5rem_1fr] gap-3 rounded-card border border-line bg-surface/55 p-4">
                  <span className="font-mono text-xs font-semibold text-included">{number}</span>
                  <div>
                    <h3 className="font-semibold text-ink">{title}</h3>
                    <p className="mt-1 text-sm leading-6 text-ink-2">{description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-card border border-line-2 bg-ink p-6 text-canvas sm:p-8">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-included">Promotion thresholds</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em] text-white">All gates must pass together.</h2>
            <dl className="mt-7 divide-y divide-white/10">
              {[
                ["Acceptance in each arm", `≥ ${percent(evidence.thresholds.minimumAcceptanceRate)}`],
                ["Slice acceptance deficit", `≤ ${percent(evidence.thresholds.maximumAcceptanceRateGap)}`],
                ["Median total-token reduction", `≥ ${percent(evidence.thresholds.minimumMedianTotalTokenReduction)}`],
                ["Pairs with lower token use", `≥ ${evidence.thresholds.minimumPairsWithTokenReduction}/${evidence.progress.expectedPairs}`],
                ["Critical regressions", `≤ ${evidence.thresholds.maximumCriticalRegressions}`],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-5 py-4 text-sm">
                  <dt className="text-canvas/75">{label}</dt>
                  <dd className="font-mono font-semibold text-white">{value}</dd>
                </div>
              ))}
            </dl>
            {evidence.metrics ? (
              <p className="mt-6 rounded-card border border-included/40 bg-included/10 p-4 text-sm leading-6 text-canvas">
                Complete evidence: median total-token reduction {percent(evidence.metrics.medianTotalTokenReduction)}.
              </p>
            ) : (
              <p className="mt-6 rounded-card border border-white/15 bg-white/5 p-4 text-sm leading-6 text-canvas/75">
                Outcome metrics are withheld while evidence is incomplete. Zero is not being presented as a measured result.
              </p>
            )}
          </div>
        </section>

        <section className="mt-16">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-muted">Frozen case ledger</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-ink">Every task is inspectable.</h2>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <a className="font-semibold text-included hover:underline" href={`${evidenceBase}/contract.json`}>Contract</a>
              <a className="font-semibold text-included hover:underline" href={`${evidenceBase}/results.json`}>Raw results</a>
              <a className="font-semibold text-included hover:underline" href={`${evidenceBase}/public-report.json`}>Public report</a>
            </div>
          </div>
          <div className="mt-7 overflow-hidden rounded-card border border-line-2 bg-surface/75">
            <ul className="divide-y divide-line">
              {contract.cases.map((testCase, index) => (
                <li key={testCase.id} className="grid gap-3 p-4 sm:grid-cols-[2.5rem_1fr_auto] sm:items-center sm:px-5">
                  <span className="font-mono text-xs text-muted">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <p className="text-sm font-semibold text-ink">{testCase.task}</p>
                    <p className="mt-1 font-mono text-[11px] text-muted">{repoName(testCase.repository)} · {testCase.snapshotSha.slice(0, 10)}</p>
                  </div>
                  <span className="w-fit rounded-full border border-line-2 px-2.5 py-1 text-[11px] font-semibold text-muted">
                    Frozen
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
    </MarketingShell>
  );
}

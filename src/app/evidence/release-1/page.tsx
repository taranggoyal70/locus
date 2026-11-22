import type { Metadata } from "next";

import contract from "../../../../benchmarks/release1/contract.json";
import report from "../../../../benchmarks/release1/public-report.json";
import { MarketingShell } from "@/components/MarketingShell";
import { selfServeOpen } from "@/lib/admission";
import { frame, Rule, SectionLabel } from "@/components/Datasheet";
import { monoLabel, PageHeader } from "@/components/PageHeader";

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

const sectionGrid = "grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10";
const sectionHeading = "font-display text-[clamp(32px,3.6vw,48px)] font-normal leading-[1.02] tracking-[-0.02em] text-ink";

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
      <main>
        <PageHeader
          label="Release 1 / public evidence"
          title="The claim stays locked"
          subtitle="until the evidence is complete."
          aside={
            <div className="w-full rounded-card border border-ink bg-surface p-6 lg:w-[300px]">
              <div className="flex items-center justify-between gap-4">
                <span className={monoLabel}>Gate status</span>
                <span className="rounded-chip border border-widened/40 px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-widened">
                  {evidence.gatePassed ? "Passed" : "Locked"}
                </span>
              </div>
              <p className="mt-6 font-display text-[56px] font-normal leading-none tracking-[-0.02em] text-ink tabular-nums">
                {evidence.progress.validResults}<span className="text-xl text-muted">/{evidence.progress.expectedResults}</span>
              </p>
              <p className="mt-2 text-[14px] text-ink-2">valid reviewed arm results</p>
              <div
                className="mt-5 h-1.5 overflow-hidden rounded-[2px] bg-surface-2"
                role="progressbar"
                aria-label="Valid reviewed arm results"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(completion * 100)}
                aria-valuetext={`${percent(completion)} complete`}
              >
                <div className="h-full bg-included" style={{ width: percent(completion) }} />
              </div>
            </div>
          }
        >
          Twenty historical engineering tasks, two context arms, one frozen protocol. Human
          reviewers decide correctness without seeing which arm produced the proposal. Missing,
          rejected, duplicated, or mismatched evidence cannot pass the gate.
        </PageHeader>

        <section className={`${frame} pb-14 sm:pb-20`} aria-label="Study summary">
          <dl className="grid grid-cols-2 border-t border-ink lg:grid-cols-4">
            {[
              ["Frozen tasks", String(evidence.study.caseCount)],
              ["Public repositories", String(evidence.study.repositoryCount)],
              ["Complete pairs", `${evidence.progress.completePairs}/${evidence.progress.expectedPairs}`],
              ["Review", evidence.study.blindedReview ? "Arm-blinded" : "Not blinded"],
            ].map(([label, value], index) => (
              <div
                key={label}
                className={`border-b border-line py-5 pr-4 lg:border-b-0 ${index % 2 === 1 ? "border-l pl-4 lg:pl-6" : ""} ${index === 2 ? "lg:border-l lg:pl-6" : ""}`}
              >
                <dt className={monoLabel}>{label}</dt>
                <dd className="mt-3 font-display text-[26px] font-normal leading-none tracking-[-0.02em] text-ink tabular-nums sm:text-[32px]">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <Rule />

        <section className={`${frame} py-14 sm:py-20`}>
          <div className={sectionGrid}>
            <SectionLabel n="01" label="Protocol" />
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
              <div>
                {/* One sentence per line: as one line, the first two sat on the edge of the
                    column and wrapped differently once the serif loaded, moving the page. */}
                <h2 className={sectionHeading}>
                  <span className="block">Same task.</span>
                  <span className="block">Same limits.</span>
                  <span className="block text-muted">Different context.</span>
                </h2>
                <ol className="mt-8 border-t border-ink">
                  {[
                    ["01", "Freeze", "Repository snapshot, model, prompt, tools, token budget, and review rubric are immutable."],
                    ["02", "Pair", "Each task runs once with the Locus Slice and once with every supported source file."],
                    ["03", "Blind review", "Criterion-level human review happens before the arm and token usage are revealed."],
                    ["04", "Fail closed", "Only complete, accepted pairs contribute a token reduction. Critical regressions fail the study."],
                  ].map(([number, title, description]) => (
                    <li key={number} className="grid grid-cols-[40px_1fr] gap-x-4 border-b border-line-2 py-5">
                      <span className="pt-1.5 font-mono text-[11px] text-muted tabular-nums">{number}</span>
                      <div>
                        <h3 className="font-display text-[24px] font-normal leading-tight tracking-[-0.015em] text-ink">{title}</h3>
                        <p className="mt-1.5 text-[15px] leading-6 text-ink-2">{description}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <div data-band="dark" className="h-fit rounded-card bg-canvas p-7 text-ink sm:p-9">
                <p className={monoLabel}>Promotion thresholds</p>
                <h2 className="mt-4 font-display text-[32px] font-normal leading-[1.05] tracking-[-0.02em] text-ink">
                  <span className="block">All gates must</span>
                  <span className="block">pass together.</span>
                </h2>
                <dl className="mt-7 border-t border-line-2">
                  {[
                    ["Acceptance in each arm", `≥ ${percent(evidence.thresholds.minimumAcceptanceRate)}`],
                    ["Slice acceptance deficit", `≤ ${percent(evidence.thresholds.maximumAcceptanceRateGap)}`],
                    ["Median total-token reduction", `≥ ${percent(evidence.thresholds.minimumMedianTotalTokenReduction)}`],
                    ["Pairs with lower token use", `≥ ${evidence.thresholds.minimumPairsWithTokenReduction}/${evidence.progress.expectedPairs}`],
                    ["Critical regressions", `≤ ${evidence.thresholds.maximumCriticalRegressions}`],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-baseline justify-between gap-5 border-b border-line py-3.5 text-[14px]">
                      <dt className="text-ink-2">{label}</dt>
                      <dd className="font-mono font-medium text-ink tabular-nums">{value}</dd>
                    </div>
                  ))}
                </dl>
                {evidence.metrics ? (
                  <p className="mt-6 border-l-2 border-included pl-4 text-[14px] leading-6 text-ink">
                    Complete evidence: median total-token reduction {percent(evidence.metrics.medianTotalTokenReduction)}.
                  </p>
                ) : (
                  <p className="mt-6 border-l-2 border-line-2 pl-4 text-[14px] leading-6 text-ink-2">
                    Outcome metrics are withheld while evidence is incomplete. Zero is not being presented as a measured result.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        <Rule />

        <section className={`${frame} py-14 sm:py-20`}>
          <div className={sectionGrid}>
            <SectionLabel n="02" label="Frozen case ledger" />
            <div>
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <h2 className={sectionHeading}>Every task is inspectable.</h2>
                <p className="max-w-sm text-[14px] leading-6 text-ink-2">
                  The frozen protocol, completion state, thresholds, and case ledger are published on
                  this page.
                </p>
              </div>
              <ul className="mt-8 border-t border-ink">
                {contract.cases.map((testCase, index) => (
                  <li key={testCase.id} className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-baseline gap-x-4 border-b border-line py-4">
                    <span className="font-mono text-[11px] text-muted tabular-nums">{String(index + 1).padStart(2, "0")}</span>
                    <div className="min-w-0">
                      <p className="text-[15px] font-medium text-ink">{testCase.task}</p>
                      <p className="mt-1 truncate font-mono text-[11px] text-muted">{repoName(testCase.repository)} · {testCase.snapshotSha.slice(0, 10)}</p>
                    </div>
                    <span className="rounded-chip border border-line-2 px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted">Frozen</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </main>
    </MarketingShell>
  );
}

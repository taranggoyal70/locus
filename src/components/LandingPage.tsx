import Link from "next/link";

import { selfServeOpen } from "@/lib/admission";
import { admissionTag } from "@/lib/admission-copy";
import { Aperture } from "@/components/Aperture";
import { CaseBoard } from "@/components/CaseBoard";
import { FigCaption, frame, Rule, SectionLabel } from "@/components/Datasheet";
import { MarketingShell } from "@/components/MarketingShell";
import { Mechanism } from "@/components/Mechanism";
import { Postmark } from "@/components/Postmark";
import { CountUp, RiseWords } from "@/components/Reveal";
import { BENCHMARK_CASES, BENCHMARK_SUMMARY, FEATURED_COMMIT } from "@/lib/benchmark-cases";
import { RECORDED_SLICE } from "@/lib/landing-slice";

const runPhases = [
  ["Locate", "Build a deterministic dependency graph and admit the smallest defensible Slice."],
  ["Implement", "Work inside an isolated Sandbox. Every Widen stays visible in the ledger."],
  ["Check", "Run allowlisted commands and store their exact exit status and relevant output."],
  ["Review", "Inspect the complete proposal. External GitHub writes stay disabled in early access."],
];

// Read from benchmarks/heldout/results.json, so a new benchmark run updates the page.
const {
  cases,
  repositories,
  fixFileRecallPct,
  localizedCases,
  widenedCases,
  medianContextReductionPct,
  chanceRecallPct,
  generatedAt,
} = BENCHMARK_SUMMARY;
const evidence = [
  { value: fixFileRecallPct, suffix: "%", label: "fix-file recall on held-out Repos", note: `${cases} fixes across ${repositories} third-party Repos, every one scored` },
  { value: medianContextReductionPct, suffix: "%", label: "median estimated context reduction", note: `on the ${localizedCases} cases Locus localized; ${widenedCases} Widened to the whole Repo` },
  { value: chanceRecallPct, suffix: "%", label: "recall of a random Slice", note: "the same number of files on those cases, picked blindly" },
];
const benchmarkDate = new Date(generatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

const primaryAction =
  "inline-flex h-11 items-center justify-center gap-2 rounded-chip bg-ink px-5 text-[15px] font-medium text-canvas transition-[background-color,transform] duration-150 hover:bg-ink/88 active:scale-[0.97]";
const secondaryAction =
  "inline-flex h-11 items-center justify-center gap-2 rounded-chip border border-line-2 bg-transparent px-5 text-[15px] font-medium text-ink transition-[border-color,background-color,transform] duration-150 hover:border-ink hover:bg-surface active:scale-[0.97]";
const textLink = "text-[14px] font-medium text-ink underline decoration-line-2 underline-offset-[5px] transition-colors hover:decoration-ink";
const sectionHeading = "font-display text-[clamp(32px,4.4vw,56px)] font-normal leading-none tracking-[-0.02em] text-ink";
const sectionGrid = "grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10";

export function LandingPage() {
  const open = selfServeOpen();
  return (
    <MarketingShell selfServeOpen={open}>
      <main>
        <section className={`${frame} pb-14 pt-16 sm:pb-20 sm:pt-24`}>
          <RiseWords
            as="h1"
            onLoad
            lines={["Ship the task.", { text: "Not the repo.", className: "text-muted" }]}
            className="font-display text-[clamp(46px,9.4vw,136px)] font-normal leading-[0.95] tracking-[-0.02em] text-ink"
          />
          <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <p className="max-w-xl text-lg leading-7 text-ink-2 sm:text-xl sm:leading-8">
                Paste a public GitHub project. Locus finds the files an AI coding tool needs and shows why.
              </p>
              <p className="mt-3 text-sm text-muted">
                Free for JavaScript, TypeScript, and Python Repos. No card. No repository write access.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
              <Link href="/workspace" className={primaryAction}>Localize a public Repo <span aria-hidden="true">↗</span></Link>
              <a href="#try" className={textLink}>Try a task here, no sign-in</a>
              <Link href="/demo" className={textLink}>Watch the migration demo</Link>
            </div>
          </div>
        </section>

        <Rule />

        <section id="try" className={`${frame} scroll-mt-16 py-16 sm:py-20`}>
          <div className={sectionGrid}>
            <SectionLabel n="01" label="The Slice" />
            <RiseWords lines={["Give it a task.", { text: "It runs in this tab.", className: "text-muted" }]} className={sectionHeading} />
          </div>
          <figure className="mt-10 sm:mt-14">
            <Aperture />
            <FigCaption n={1}>
              One mark per file in a bundled copy of shadcn-ui/taxonomy. This is the real localizer, running on this
              page: your task is not sent anywhere.
            </FigCaption>
          </figure>
          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link href="/workspace" className={secondaryAction}>Use it on your own public Repo</Link>
            <p className="text-[13px] text-muted">Needs a free account. Nothing is written to your repository.</p>
          </div>
        </section>

        <Rule />

        <section className={`${frame} py-16 sm:py-20`}>
          <div className={sectionGrid}>
            <SectionLabel n="02" label="Mechanism" />
            <div>
              <RiseWords lines={["From a sentence", { text: "to a Slice.", className: "text-muted" }]} className={sectionHeading} />
              <p className="mt-5 max-w-xl text-[15px] leading-6 text-ink-2">
                Locus matches the task against the Repo to find Anchors, follows their imports out one hop at a time,
                and stops. When nothing matches with enough evidence, it Widens to the whole Repo instead of guessing.
              </p>
            </div>
          </div>
          <figure className="mt-10 sm:mt-14">
            <Mechanism />
            <FigCaption n={2}>
              How Locus built the Slice for &ldquo;{RECORDED_SLICE.task}&rdquo;, from a recorded run. Highlighted words
              are task terms found in the Anchor paths; each line is a real import between Slice files.
            </FigCaption>
          </figure>
        </section>

        <Rule />

        <section id="evidence" className={`${frame} scroll-mt-16 py-16 sm:py-20`}>
          <div className={sectionGrid}>
            <SectionLabel n="03" label="Evidence" />
            <div>
              <RiseWords
                lines={fixFileRecallPct === 100
                  ? ["Every fix file,", { text: "in the Slice.", className: "text-muted" }]
                  : ["Fix-file recall,", { text: "case by case.", className: "text-muted" }]}
                className={sectionHeading}
              />
              <p className="mt-5 max-w-xl text-[15px] leading-6 text-ink-2">
                {cases} fixes from {repositories} third-party Repos that Locus was never developed or tuned against, chosen by
                a written rule rather than by hand. Locus ran on each fix&rsquo;s parent commit and had to admit the files the
                maintainer went on to change. Every case is below, Widened ones included.
              </p>
              <div className="mt-10 grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                {evidence.map(({ value, suffix, label, note }) => (
                  <div key={label} className="py-6 first:pt-0 sm:px-7 sm:py-0 sm:first:pl-0 sm:last:pr-0">
                    <CountUp value={value} suffix={suffix} className="block font-display text-5xl font-normal tracking-[-0.02em] text-ink tabular-nums" />
                    <p className="mt-3 text-sm font-semibold text-ink">{label}</p>
                    <p className="mt-1 text-[13px] leading-5 text-muted">{note}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <figure className="mt-10 sm:mt-14">
            <CaseBoard cases={BENCHMARK_CASES} featured={FEATURED_COMMIT} />
            <FigCaption n={3}>
              Every held-out case, a tab per Repo and a row per fix, drawn as one mark per percent of the Repo&rsquo;s
              source files; a fix file always takes a mark. Hover, focus, or tap a row to inspect it. Reduction compares
              estimated tokens, one per four characters, in the Slice and the whole Repo. From
              benchmarks/heldout/results.json, generated {benchmarkDate}. It does not measure agent completion.
            </FigCaption>
          </figure>
        </section>

        <Rule />

        <section className={`${frame} py-16 sm:py-20`}>
          <div className={sectionGrid}>
            <SectionLabel n="04" label="Agent Runs" />
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-14">
              <div>
                <RiseWords lines={["A Run you can leave,", { text: "and trust when you come back.", className: "text-muted" }]} className={sectionHeading} />
                <p className="mt-5 max-w-md text-[15px] leading-6 text-ink-2">
                  {open ? "Any verified account" : "Invited design partners"} can continue from an explained Slice into an
                  isolated Sandbox and a review-ready, check-passing proposal.
                </p>
                <Link href={open ? "/workspace" : "/pricing"} className={`${secondaryAction} mt-6`}>
                  {open ? "Start an Agent Run" : "Request Agent Run access"}
                </Link>
                <p className="mt-4 font-mono text-[11px] text-muted">{admissionTag(open)}</p>
              </div>
              <ol className="border-t border-ink">
                {runPhases.map(([phase, description], index) => (
                  <li key={phase} className="grid gap-2 border-b border-line-2 py-5 sm:grid-cols-[40px_140px_1fr] sm:items-baseline sm:gap-4">
                    <span className="font-mono text-[11px] text-muted tabular-nums">0{index + 1}</span>
                    <span className="font-display text-[26px] leading-none tracking-[-0.015em] text-ink">{phase}</span>
                    <p className="text-[15px] leading-6 text-ink-2">{description}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <Rule />

        <section className="bg-canvas-2 py-16 sm:py-24">
          <div className={frame}>
            <div className="grid overflow-hidden rounded-card border border-ink bg-surface lg:grid-cols-[minmax(0,1fr)_300px]">
              <div className="p-7 sm:p-10 lg:p-12">
                <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                  The early-access contract
                </p>
                <RiseWords
                  lines={["A smaller admitted context,", { text: "with every exclusion visible.", className: "text-muted" }]}
                  className={`mt-5 max-w-3xl ${sectionHeading}`}
                />
                <p className="mt-6 max-w-xl text-[15px] leading-6 text-ink-2">
                  Token efficiency is the hypothesis. Early access records factual usage, checks, and failures
                  before making any whole-loop Savings claim.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
                  <Link href="/workspace" className={primaryAction}>Localize a public Repo <span aria-hidden="true">↗</span></Link>
                  <Link href="/evidence/release-1" className={textLink}>Read the evidence</Link>
                </div>
              </div>
              <div className="ticket-stub flex flex-col justify-between gap-10 border-t border-dashed border-line-2 p-7 sm:p-10 lg:border-l lg:border-t-0 lg:px-8">
                <dl>
                  {[
                    ["Repo", "Public GitHub"],
                    ["Languages", "JS · TS · Python"],
                    ["Card", "None"],
                    ["Write access", "None"],
                  ].map(([name, value]) => (
                    <div key={name} className="flex items-baseline justify-between gap-4 border-b border-line py-3 first:pt-0">
                      <dt className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted">{name}</dt>
                      <dd className="text-[14px] font-medium text-ink">{value}</dd>
                    </div>
                  ))}
                </dl>
                <Postmark />
              </div>
            </div>
          </div>
        </section>
      </main>
    </MarketingShell>
  );
}

import Link from "next/link";

import { selfServeOpen } from "@/lib/admission";
import { admissionTag } from "@/lib/admission-copy";
import { frame, Rule, SectionHead } from "@/components/Datasheet";
import { FeatureGlyph, type GlyphKind } from "@/components/FeatureGlyph";
import { MarketingShell } from "@/components/MarketingShell";
import { LocusFigure } from "@/components/LocusFigure";
import { Mascot } from "@/components/Mascot";
import { ProductDemo } from "@/components/ProductDemo";
import { CountUp, EnterOnce, RiseWords } from "@/components/Reveal";
import { TypeLens } from "@/components/TypeLens";
import { BENCHMARK_CASES, BENCHMARK_SUMMARY } from "@/lib/benchmark-cases";
import { demoRun } from "@/lib/demo-script";
import { RECORDED_RESULT, RECORDED_SLICE } from "@/lib/landing-slice";

const RUN = demoRun(RECORDED_RESULT);
const n = (value: number) => value.toLocaleString("en-US");

/** Five steps of one recorded run, each with that run's own numbers. */
const features: Array<{ kind: GlyphKind; label: string; title: string; body: string; table: [string, string][] }> = [
  {
    kind: "localize",
    label: "Localize",
    title: "Finds where the task lives.",
    body: "Locus matches the task against the Repo to find the Anchors. When nothing matches with enough evidence, it Widens to the whole Repo instead of guessing.",
    table: [["Anchors", String(RECORDED_SLICE.anchors.length)], ["Matched", RUN.terms.join(", ")]],
  },
  {
    kind: "follow",
    label: "Follow",
    title: "Follows the imports out.",
    body: "From each Anchor it walks the import graph one hop at a time, so the code the change leans on comes with it.",
    table: [["Hops", String(RUN.maxHop)], ["Imports", String(RECORDED_SLICE.edges.length)]],
  },
  {
    kind: "explain",
    label: "Explain",
    title: "Says why each file is there.",
    body: "Every file in the Slice carries its reason: a match, or how many hops from one. Every file left out stays one click away.",
    table: [["In the Slice", String(RUN.rows.length)], ["Left out", String(RUN.fileCount - RUN.rows.length)]],
  },
  {
    kind: "measure",
    label: "Measure",
    title: "Counts the context.",
    body: "It estimates the tokens in the Slice and in the whole Repo, so you see the reduction before an agent spends it.",
    table: [["Slice", n(RUN.sliceTokens)], ["Whole Repo", n(RUN.totalTokens)]],
  },
  {
    kind: "handoff",
    label: "Hand off",
    title: "Hands it to your agent.",
    body: "Copy the Slice in a generic, Claude or Cursor format, or download it. Locus never writes to your repository.",
    table: [["Formats", "3"], ["Write access", "None"]],
  },
];

const runPhases = [
  ["Locate", "A deterministic graph and the smallest defensible Slice."],
  ["Implement", "An isolated Sandbox; every Widen stays in the ledger."],
  ["Check", "Allowlisted commands, with exact exit status and output."],
  ["Review", "The complete proposal. GitHub writes stay off in early access."],
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

/** One row of marks per held-out Repo, one mark per fix. */
const caseRows = [...new Set(BENCHMARK_CASES.map(({ repo }) => repo))].map((repo) => ({
  repo,
  cases: BENCHMARK_CASES.filter((item) => item.repo === repo).map((item) => ({
    commit: item.commit,
    kind: item.widened ? "widened" : item.found.length === item.fixFiles.length ? "found" : "missed",
  })),
}));
const anyMissed = BENCHMARK_CASES.some((item) => !item.widened && item.found.length < item.fixFiles.length);

const primaryAction =
  "inline-flex h-11 items-center justify-center gap-2 rounded-chip bg-ink px-5 text-[15px] font-medium text-canvas transition-[background-color,transform] duration-150 hover:bg-ink/88 active:scale-[0.97]";
const secondaryAction =
  "inline-flex h-11 items-center justify-center gap-2 rounded-chip border border-line-2 bg-transparent px-5 text-[15px] font-medium text-ink transition-[border-color,background-color,transform] duration-150 hover:border-ink hover:bg-surface active:scale-[0.97]";
const textLink = "text-[14px] font-medium text-ink underline decoration-line-2 underline-offset-[5px] transition-colors hover:decoration-ink";
const monoLabel = "font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted";
const sectionHeading = "font-display text-[clamp(32px,4.4vw,56px)] font-normal leading-[1.02] tracking-[-0.02em] text-ink";

export function LandingPage() {
  const open = selfServeOpen();
  return (
    <MarketingShell selfServeOpen={open}>
      <main>
        <section className={`${frame} pb-16 pt-12 sm:pt-16 lg:pb-24`}>
          <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
            <div>
              <p className={monoLabel}>Locus / Context for coding agents</p>
              <div className="mt-6">
                <TypeLens>
                  <RiseWords
                    as="h1"
                    onLoad
                    lines={["Ship the task.", { text: "Not the repo.", className: "text-muted" }]}
                    className="font-display text-[clamp(46px,5.4vw,74px)] font-normal leading-[0.98] tracking-[-0.022em] text-ink"
                  />
                </TypeLens>
              </div>
              <p className="mt-6 max-w-md text-[18px] leading-7 text-ink-2">
                Paste a public GitHub project. Locus finds the files an AI coding tool needs and shows why.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
                <Link href="/workspace" className={primaryAction}>Localize a public Repo <span aria-hidden="true">↗</span></Link>
                <a href="#try" className={`${textLink} lg:hidden`}>Try a task here, no sign-in</a>
                <Link href="/demo" className={`${textLink} max-lg:hidden`}>Watch the migration demo</Link>
              </div>
              <p className="mt-6 max-w-md text-[13px] leading-5 text-muted">
                Free for JavaScript, TypeScript, and Python Repos. No card. No repository write access.
              </p>
            </div>
            <ProductDemo />
          </div>
        </section>

        <section data-band="dark" className="overflow-hidden bg-canvas py-16 text-ink sm:py-24">
          <div className={frame}>
            <SectionHead n="01" label="The locus" status={`Recorded on ${RECORDED_SLICE.repo}`} lines={["Near the task,", "or left on the rim."]} />
            <p className="mb-12 mt-6 max-w-xl text-[16px] leading-7 text-ink-2">
              Every square is one of {RUN.fileCount} files. The Anchors sit in the middle, and each ring is one import further
              out. When a task is too vague to place, Locus Widens and keeps every file.
            </p>
            <LocusFigure />
          </div>
        </section>

        <section className={`${frame} py-16 sm:py-24`}>
          <SectionHead n="02" label="How it works" status={`Measured on ${RECORDED_SLICE.repo}`} lines={["From a sentence", "to the files that matter."]} />
          <ol className="mt-12 grid border-t border-ink sm:grid-cols-2 lg:grid-cols-5">
            {features.map((feature, index) => (
              <li key={feature.kind} className="feature-col grid grid-cols-[88px_minmax(0,1fr)] gap-x-6 border-b border-line py-8 sm:block sm:px-6 lg:border-b-0 lg:px-5">
                <FeatureGlyph kind={feature.kind} />
                <div className="sm:mt-7">
                  <p className={monoLabel}>
                    <span className="text-ink tabular-nums">0{index + 1}</span> {feature.label}
                  </p>
                  <h3 className="mt-3 font-display text-[24px] font-normal leading-[1.12] tracking-[-0.012em] text-ink">{feature.title}</h3>
                  <dl className="mt-4 border-y border-line font-mono text-[11px]">
                    {feature.table.map(([name, value], row) => (
                      <div key={name} className={`flex items-baseline justify-between gap-3 py-1.5 ${row > 0 ? "border-t border-line" : ""}`}>
                        <dt className="uppercase tracking-[0.08em] text-muted">{name}</dt>
                        <dd className="truncate text-ink tabular-nums">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-4 text-[14.5px] leading-6 text-ink-2">{feature.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <Rule />

        <section id="evidence" className={`${frame} scroll-mt-16 py-16 sm:py-24`}>
          <SectionHead
            n="03"
            label="Evidence"
            status={`${cases} held-out fixes · ${repositories} Repos`}
            lines={fixFileRecallPct === 100 ? ["Every fix file,", "in the Slice."] : ["Fix-file recall,", "case by case."]}
          />
          <div className="mt-8 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16">
            <div>
              <p className="max-w-xl text-[15px] leading-6 text-ink-2">
                {cases} fixes from {repositories} third-party Repos that Locus was never developed or tuned against, chosen by
                a written rule rather than by hand. Locus ran on each fix&rsquo;s parent commit and had to admit the files the
                maintainer went on to change.
              </p>
              <div className="mt-10 grid divide-y divide-line border-t border-ink sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                {evidence.map(({ value, suffix, label, note }) => (
                  <div key={label} className="py-6 sm:px-5 sm:first:pl-0 sm:last:pr-0">
                    <CountUp value={value} suffix={suffix} className="block font-display text-5xl font-normal tracking-[-0.02em] text-ink tabular-nums" />
                    <p className="mt-3 text-sm font-semibold text-ink">{label}</p>
                    <p className="mt-1 text-[13px] leading-5 text-muted">{note}</p>
                  </div>
                ))}
              </div>
            </div>
            <figure className="self-start rounded-card border border-line-2 bg-surface p-5 sm:p-7">
              <div className="flex items-baseline justify-between gap-4">
                <p className={monoLabel}>Every case</p>
                <p className="font-mono text-[11px] text-muted tabular-nums">{cases} fixes</p>
              </div>
              <EnterOnce className="case-strip"><ul className="mt-5 space-y-3">
                {caseRows.map((row, rowIndex) => (
                  <li key={row.repo} style={{ "--row": rowIndex } as React.CSSProperties} className="grid items-center gap-x-4 gap-y-1.5 sm:grid-cols-[160px_minmax(0,1fr)]">
                    <span className="truncate font-mono text-[12px] text-ink-2">{row.repo}</span>
                    <span className="flex flex-wrap gap-[5px]">
                      {row.cases.map((item, index) => (
                        <span key={item.commit} className="case-dot" data-kind={item.kind} style={{ "--i": index } as React.CSSProperties} />
                      ))}
                    </span>
                  </li>
                ))}
              </ul></EnterOnce>
              <figcaption className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-4 font-mono text-[11px] text-muted">
                <span className="flex items-center gap-2"><span className="case-dot" data-kind="found" />Every fix file in the Slice</span>
                <span className="flex items-center gap-2"><span className="case-dot" data-kind="widened" />Widened to the whole Repo</span>
                {anyMissed && <span className="flex items-center gap-2"><span className="case-dot" data-kind="missed" />A fix file missed</span>}
              </figcaption>
              <div className="mt-5 flex flex-col gap-2">
                <Link href="/evidence/release-1#cases" className={`${textLink} self-start`}>Inspect every case <span aria-hidden="true">→</span></Link>
                <p className="text-[12px] leading-5 text-muted">From benchmarks/heldout/results.json, generated {benchmarkDate}. It does not measure agent completion.</p>
              </div>
            </figure>
          </div>
        </section>

        <Rule />

        <section className={`${frame} py-16 sm:py-24`}>
          <SectionHead n="04" label="Two ways to use it" status={open ? "Free · Self-serve" : "Free · Invite-gated"} lines={["One Slice.", "Two ways to use it."]} />
          <div className="mt-12 grid overflow-hidden rounded-card border border-ink lg:grid-cols-2">
            <div className="flex flex-col bg-surface p-7 sm:p-10">
              <p className="flex items-center justify-between gap-4">
                <span className={monoLabel}>Localize</span>
                <span className="rounded-[2px] border border-line-2 px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.1em] text-ink">Free</span>
              </p>
              <h3 className="mt-6 font-display text-[34px] font-normal leading-[1.05] tracking-[-0.015em] text-ink">Bring your own agent.</h3>
              <p className="mt-4 max-w-md text-[15px] leading-6 text-ink-2">
                Find the Slice for a task, read why each file is in it, and copy it into the coding tool you already use.
              </p>
              <dl className="mt-7 border-t border-ink">
                {[
                  ["Repos", "Public GitHub"],
                  ["Languages", "JS · TS · Python"],
                  ["Formats", "Generic · Claude · Cursor"],
                  ["Card", "None"],
                ].map(([name, value]) => (
                  <div key={name} className="flex items-baseline justify-between gap-4 border-b border-line py-3">
                    <dt className={monoLabel}>{name}</dt>
                    <dd className="text-[14px] font-medium text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-auto pt-8">
                <Link href="/workspace" className={primaryAction}>Localize a public Repo <span aria-hidden="true">↗</span></Link>
              </div>
            </div>
            <div data-band="dark" className="flex flex-col bg-canvas p-7 text-ink sm:p-10">
              <p className="flex items-center justify-between gap-4">
                <span className={monoLabel}>Agent Runs</span>
                <span className="rounded-[2px] border border-line-2 px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.1em] text-included-ink">
                  {open ? "Self-serve" : "Invite-gated"}
                </span>
              </p>
              <h3 className="mt-6 font-display text-[34px] font-normal leading-[1.05] tracking-[-0.015em] text-ink">A Run you can leave.</h3>
              <p className="mt-4 max-w-md text-[15px] leading-6 text-ink-2">
                {open ? "Any verified account" : "Invited design partners"} can continue from an explained Slice into an
                isolated Sandbox and a review-ready, check-passing proposal.
              </p>
              <ol className="mt-7 border-t border-ink">
                {runPhases.map(([phase, description], index) => (
                  <li key={phase} className="grid grid-cols-[28px_minmax(0,1fr)] items-baseline gap-x-3 gap-y-0.5 border-b border-line py-3 sm:grid-cols-[28px_92px_minmax(0,1fr)]">
                    <span className="font-mono text-[11px] text-muted tabular-nums">0{index + 1}</span>
                    <span className="text-[14px] font-medium text-ink">{phase}</span>
                    <span className="col-start-2 text-[13px] leading-5 text-ink-2 sm:col-start-auto">{description}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-auto flex flex-col items-start gap-3 pt-8">
                <Link href={open ? "/workspace" : "/pricing"} className={secondaryAction}>
                  {open ? "Start an Agent Run" : "Request Agent Run access"}
                </Link>
                <p className="font-mono text-[11px] leading-5 text-muted">{admissionTag(open)}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-canvas-2 py-16 sm:py-24">
          <div className={frame}>
            <div className="grid overflow-hidden rounded-card border border-ink bg-surface lg:grid-cols-[minmax(0,1fr)_300px]">
              <div className="p-7 sm:p-10 lg:p-12">
                <p className={monoLabel}>The early-access contract</p>
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
                      <dt className={monoLabel}>{name}</dt>
                      <dd className="text-[14px] font-medium text-ink">{value}</dd>
                    </div>
                  ))}
                </dl>
                <div aria-hidden="true" className="flex items-center gap-3">
                  <EnterOnce className="seal relative grid h-[116px] w-[116px] shrink-0 place-items-center">
                    <svg viewBox="-64 -64 128 128" className="absolute inset-0">
                      <circle r={62} fill="none" stroke="var(--line-2)" />
                      <circle r={42} fill="none" stroke="var(--line-2)" strokeDasharray="3 3" />
                      <g className="seal-ring">
                        <path id="seal-path" d="M0 48A48 48 0 1 1 .01 48" fill="none" />
                        <text><textPath href="#seal-path" textLength={296}>SHADCN-UI/TAXONOMY · LOCALIZED · </textPath></text>
                      </g>
                    </svg>
                    <span className="relative pt-1"><Mascot mood="found" size={44} /></span>
                  </EnterOnce>
                  <div className="whitespace-nowrap font-mono text-[11px] leading-5 tracking-[0.04em] text-muted">
                    <p>SLICE {RUN.rows.length} / {RUN.fileCount}</p>
                    <p>ANCHORS {RECORDED_SLICE.anchors.length}</p>
                    <p>WIDEN 0</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </MarketingShell>
  );
}

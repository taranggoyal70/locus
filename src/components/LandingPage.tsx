import Link from "next/link";

import { selfServeOpen } from "@/lib/admission";
import { admissionTag } from "@/lib/admission-copy";
import { Aperture } from "@/components/Aperture";
import { FigCaption, frame, Rule, SectionLabel } from "@/components/Datasheet";
import { MarketingShell } from "@/components/MarketingShell";
import { Mechanism } from "@/components/Mechanism";
import { CountUp, RiseWords } from "@/components/Reveal";
import { RECORDED_SLICE } from "@/lib/landing-slice";

const runPhases = [
  ["Locate", "Build a deterministic dependency graph and admit the smallest defensible Slice."],
  ["Implement", "Work inside an isolated Sandbox. Every Widen stays visible in the ledger."],
  ["Check", "Run allowlisted commands and store their exact exit status and relevant output."],
  ["Review", "Inspect the complete proposal. External GitHub writes stay disabled in early access."],
];

const evidence = [
  { value: 100, suffix: "%", label: "recall on the cases in our suite", note: "15 fixes across 3 repositories we own; the suite gates on full recall" },
  { value: 53, suffix: "%", label: "median estimated context reduction", note: "initial admitted context versus whole-Repo context" },
  { value: 15, suffix: "", label: "historical cases", note: "localization replay only; does not measure agent completion" },
];

const primaryAction =
  "inline-flex items-center justify-center rounded-card bg-ink px-5 py-3 text-sm font-semibold text-canvas transition-[background-color,transform] duration-150 hover:bg-ink/90 active:scale-[0.97]";
const secondaryAction =
  "inline-flex items-center justify-center rounded-card border border-line-2 bg-surface px-5 py-3 text-sm font-semibold text-ink transition-[border-color,transform] duration-150 hover:border-ink/40 active:scale-[0.97]";
const textLink = "text-sm font-semibold text-ink underline decoration-line-2 underline-offset-4 transition-colors hover:decoration-ink";
const sectionHeading = "font-display text-[clamp(32px,4.4vw,56px)] font-semibold leading-none tracking-[-0.04em] text-ink";
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
            className="font-display text-[clamp(40px,9.4vw,136px)] font-semibold leading-[0.95] tracking-[-0.04em] text-ink"
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
              <Link href="/workspace" className={primaryAction}>Localize a public Repo</Link>
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

        <section id="evidence" className={`${frame} py-16 sm:py-20`}>
          <div className={sectionGrid}>
            <SectionLabel n="03" label="Evidence" />
            <div className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {evidence.map(({ value, suffix, label, note }) => (
                <div key={label} className="py-6 first:pt-0 sm:px-7 sm:py-0 sm:first:pl-0 sm:last:pr-0">
                  <CountUp value={value} suffix={suffix} className="block font-display text-5xl font-semibold tracking-[-0.04em] text-ink tabular-nums" />
                  <p className="mt-3 text-sm font-semibold text-ink">{label}</p>
                  <p className="mt-1 text-[13px] leading-5 text-muted">{note}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <Rule />

        <section className={`${frame} py-16 sm:py-20`}>
          <div className={sectionGrid}>
            <SectionLabel n="04" label="Agent Runs" />
            <div className="grid gap-10 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)] lg:gap-14">
              <div>
                <RiseWords lines={["A Run you can leave,", { text: "and trust when you come back.", className: "text-muted" }]} className={sectionHeading} />
                <p className="mt-5 max-w-md text-[15px] leading-6 text-ink-2">
                  From an explained Slice, an Agent Run continues into an isolated Sandbox and stops at a
                  review-ready, check-passing proposal.
                </p>
                <Link href="/pricing" className={`${secondaryAction} mt-6`}>Request Agent Run access</Link>
                <p className="mt-4 font-mono text-[11px] text-muted">{admissionTag(open)}</p>
              </div>
              <ol className="border-t border-line-2">
                {runPhases.map(([phase, description], index) => (
                  <li key={phase} className="grid gap-2 border-b border-line-2 py-5 sm:grid-cols-[40px_110px_1fr] sm:items-baseline sm:gap-4">
                    <span className="font-mono text-[11px] text-muted tabular-nums">0{index + 1}</span>
                    <span className="text-lg font-semibold tracking-[-0.02em] text-ink">{phase}</span>
                    <p className="text-[15px] leading-6 text-ink-2">{description}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <Rule />

        <section className={`${frame} py-16 sm:py-20`}>
          <div data-band="dark" className="rounded-card bg-canvas px-6 py-10 text-ink sm:px-10 lg:grid lg:grid-cols-[1fr_auto] lg:items-end lg:gap-12 lg:px-14 lg:py-14">
            <div>
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted">The early-access contract</p>
              <RiseWords
                lines={["A smaller admitted context,", { text: "with every exclusion visible.", className: "text-ink-2" }]}
                className={`mt-4 max-w-3xl ${sectionHeading}`}
              />
              <p className="mt-5 max-w-2xl text-[15px] leading-6 text-ink-2">
                Token efficiency is the hypothesis. Early access records factual usage, checks, and failures
                before making any whole-loop Savings claim.
              </p>
            </div>
            <Link href="/workspace" className={`${primaryAction} mt-8 lg:mt-0`}>Localize a public Repo</Link>
          </div>
        </section>
      </main>
    </MarketingShell>
  );
}

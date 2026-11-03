import Link from "next/link";

import { selfServeOpen } from "@/lib/admission";
import { admissionTag } from "@/lib/admission-copy";
import { Aperture } from "@/components/Aperture";
import { MarketingShell } from "@/components/MarketingShell";

const runPhases = [
  ["Locate", "Build a deterministic dependency graph and admit the smallest defensible Slice."],
  ["Implement", "Work inside an isolated Sandbox. Every Widen stays visible in the ledger."],
  ["Check", "Run allowlisted commands and store their exact exit status and relevant output."],
  ["Review", "Inspect the complete proposal. External GitHub writes stay disabled in early access."],
];

const evidence = [
  ["100%", "recall on the cases in our suite", "15 fixes across 3 repositories we own; the suite gates on full recall"],
  ["53%", "median estimated context reduction", "initial admitted context versus whole-Repo context"],
  ["15", "historical cases", "localization replay only; does not measure agent completion"],
];

const primaryAction =
  "inline-flex items-center justify-center rounded-card bg-ink px-5 py-3 text-sm font-semibold text-canvas transition-[background-color,transform] duration-150 hover:bg-ink/90 active:scale-[0.97]";
const secondaryAction =
  "inline-flex items-center justify-center rounded-card border border-line-2 bg-surface px-5 py-3 text-sm font-semibold text-ink transition-[border-color,transform] duration-150 hover:border-ink/40 active:scale-[0.97]";
const eyebrow = "font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted";
const gutter = "mx-auto max-w-7xl px-5 sm:px-8";

export function LandingPage() {
  const open = selfServeOpen();
  return (
    <MarketingShell selfServeOpen={open}>
      <main>
        <section className={`${gutter} grid items-center gap-12 py-16 lg:grid-cols-[minmax(0,1fr)_minmax(420px,480px)] lg:gap-16 lg:py-24`}>
          <div>
            <h1 className="font-display text-[clamp(40px,5.6vw,76px)] font-semibold leading-none tracking-[-0.04em] text-ink">
              Ship the task.
              <span className="block text-muted">Not the repo.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-7 text-ink-2 sm:text-xl sm:leading-8">
              Paste a public GitHub project. Locus finds the files an AI coding tool needs and shows why.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <Link href="/workspace" className={primaryAction}>Localize a public Repo</Link>
              <Link href="/demo" className="text-sm font-semibold text-ink underline decoration-line-2 underline-offset-4 transition-colors hover:decoration-ink">
                Watch the migration demo
              </Link>
            </div>
            <p className="mt-4 text-sm text-muted">
              Free for JavaScript, TypeScript, and Python Repos. No card. No repository write access.
            </p>
          </div>

          <Aperture />
        </section>

        <section id="evidence" className="border-y border-line bg-surface">
          <div className={`${gutter} grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0`}>
            {evidence.map(([value, label, note]) => (
              <div key={label} className="py-8 sm:px-7 sm:first:pl-0 sm:last:pr-0">
                <p className="font-display text-5xl font-semibold tracking-[-0.04em] text-ink tabular-nums">{value}</p>
                <p className="mt-2 text-sm font-semibold text-ink">{label}</p>
                <p className="mt-1 text-[13px] leading-5 text-muted">{note}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={`${gutter} py-16 sm:py-24`}>
          <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:gap-16">
            <div>
              <p className={eyebrow}>Agent Runs</p>
              <h2 className="mt-4 max-w-md font-display text-[clamp(32px,4.4vw,56px)] font-semibold leading-none tracking-[-0.04em] text-ink">
                A Run you can leave, and trust when you come back.
              </h2>
              <p className="mt-5 max-w-md text-[15px] leading-6 text-ink-2">
                From an explained Slice, an Agent Run continues into an isolated Sandbox and stops at a
                review-ready, check-passing proposal.
              </p>
              <Link href="/pricing" className={`${secondaryAction} mt-6`}>Request Agent Run access</Link>
              <p className="mt-4 font-mono text-[11px] text-muted">{admissionTag(open)}</p>
            </div>
            <ol className="border-t border-line-2">
              {runPhases.map(([phase, description], index) => (
                <li key={phase} className="grid gap-2 border-b border-line-2 py-6 sm:grid-cols-[48px_120px_1fr] sm:items-baseline sm:gap-4">
                  <span className="font-mono text-[11px] text-muted tabular-nums">0{index + 1}</span>
                  <span className="text-xl font-semibold tracking-[-0.02em] text-ink">{phase}</span>
                  <p className="max-w-xl text-[15px] leading-6 text-ink-2">{description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={`${gutter} pb-16 sm:pb-24`}>
          <div data-band="dark" className="rounded-card bg-canvas px-6 py-10 text-ink sm:px-10 lg:grid lg:grid-cols-[1fr_auto] lg:items-end lg:gap-12 lg:px-14 lg:py-14">
            <div>
              <p className={eyebrow}>The early-access contract</p>
              <h2 className="mt-4 max-w-3xl font-display text-[clamp(32px,4.4vw,56px)] font-semibold leading-none tracking-[-0.04em]">
                A smaller admitted context, with every exclusion visible.
              </h2>
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

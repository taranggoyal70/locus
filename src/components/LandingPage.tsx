import Link from "next/link";

import { MarketingShell } from "@/components/MarketingShell";

const runPhases = [
  ["Locate", "Build a deterministic dependency graph and admit the smallest defensible Slice."],
  ["Implement", "Work inside an isolated Sandbox. Every Widen stays visible in the ledger."],
  ["Check", "Run allowlisted commands and store their exact exit status and relevant output."],
  ["Review", "Inspect the complete proposal. External GitHub writes stay disabled in the alpha."],
];

export function LandingPage() {
  return (
    <MarketingShell>
      <main>
        <section className="mx-auto grid min-h-[760px] max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,.95fr)] lg:py-24">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-surface/75 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Invite-only alpha
            </div>
            <h1 className="mt-7 font-display text-[clamp(3.6rem,8vw,7.8rem)] font-semibold leading-[.82] tracking-[-0.075em] text-paper">
              Ship the task.
              <span className="mt-2 block text-accent">Not the repo.</span>
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-8 text-muted-light sm:text-xl">
              Locus localizes a public JavaScript or TypeScript Repo, works in an isolated
              Sandbox, and returns a review-ready, check-passing proposal with every Included,
              Excluded, and Widened file visible.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/pricing" className="rounded-xl bg-paper px-5 py-3.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-paper/90">Request alpha access</Link>
              <a href="#evidence" className="rounded-xl border border-line-strong bg-surface/60 px-5 py-3.5 text-sm font-semibold text-paper transition hover:border-accent/50 hover:bg-surface">See benchmark evidence</a>
            </div>
            <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted">Controlled alpha · public Repos only · external writes disabled</p>
          </div>

          <div className="relative">
            <div className="absolute -inset-8 -z-10 rounded-full bg-accent/10 blur-3xl" />
            <div className="overflow-hidden rounded-[28px] border border-line-strong bg-surface shadow-[0_34px_90px_rgba(20,35,59,.15)]">
              <div className="flex items-center justify-between border-b border-line-strong px-5 py-4">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-accent">Illustrative example</p>
                  <p className="mt-1 text-sm font-semibold text-paper">Fix failed savings claims</p>
                </div>
                <span className="rounded-full border border-[#b78a22]/30 bg-[#f2d889]/30 px-2.5 py-1 font-mono text-[8px] font-semibold uppercase tracking-[0.1em] text-[#765a18]">Ready for review</span>
              </div>
              <div className="grid grid-cols-[88px_1fr]">
                <div className="border-r border-line-strong p-4">
                  <p className="font-mono text-[9px] text-muted">WHOLE</p>
                  <p className="mt-1 font-display text-3xl font-semibold text-paper">26</p>
                  <div className="mt-5 h-40 overflow-hidden rounded-full bg-excluded">
                    <div className="h-[27%] rounded-full bg-accent" />
                  </div>
                  <p className="mt-3 font-mono text-[9px] text-accent">7 in</p>
                  <p className="mt-1 font-mono text-[9px] text-muted">19 out</p>
                </div>
                <div className="p-5">
                  <div className="space-y-2 font-mono text-[10px]">
                    {["run-state.ts", "run-store.ts", "agent-run.ts", "approve/route.ts"].map((file, index) => (
                      <div key={file} className="flex items-center justify-between rounded-lg border border-accent/20 bg-accent/[.06] px-3 py-2.5 text-paper">
                        <span>{file}</span><span className="text-accent">IN · {index}</span>
                      </div>
                    ))}
                    {["billing.ts", "teams.ts", "opengraph.tsx"].map((file) => (
                      <div key={file} className="flex items-center justify-between px-3 py-1.5 text-muted">
                        <span>{file}</span><span>OUT</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line-strong bg-line-strong">
                    {[["Checks", "3 pass"], ["Widen", "1 file"], ["Writes", "off"]].map(([label, value]) => (
                      <div key={label} className="bg-ink p-3"><p className="font-mono text-[8px] uppercase text-muted">{label}</p><p className="mt-1 text-xs font-semibold text-paper">{value}</p></div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="aperture-rule h-2 border-t border-line-strong" />
            </div>
          </div>
        </section>

        <section id="evidence" className="border-y border-line-strong bg-surface/70">
          <div className="mx-auto grid max-w-7xl divide-y divide-line-strong px-5 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-8">
            {[
              ["100%", "historical fix-file recall", "15 declared fixes across 3 public repositories"],
              ["53%", "median estimated context reduction", "initial admitted context versus whole-Repo context"],
              ["15", "historical cases", "localization replay only; does not measure agent completion"],
            ].map(([value, label, note]) => (
              <div key={label} className="py-8 sm:px-7 sm:first:pl-0 sm:last:pr-0">
                <p className="font-display text-5xl font-semibold tracking-[-0.05em] text-paper">{value}</p>
                <p className="mt-2 text-sm font-semibold text-paper">{label}</p>
                <p className="mt-1 text-xs leading-5 text-muted-light">{note}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-[.7fr_1.3fr]">
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">One durable attempt</p>
              <h2 className="mt-4 max-w-md font-display text-5xl font-semibold leading-[.95] tracking-[-0.055em] text-paper sm:text-6xl">A Run you can leave—and trust when you return.</h2>
            </div>
            <ol className="border-t border-line-strong">
              {runPhases.map(([phase, description], index) => (
                <li key={phase} className="grid gap-3 border-b border-line-strong py-6 sm:grid-cols-[54px_130px_1fr] sm:items-start">
                  <span className="font-mono text-[10px] text-muted">0{index + 1}</span>
                  <span className="font-display text-xl font-semibold text-paper">{phase}</span>
                  <p className="max-w-xl text-sm leading-6 text-muted-light">{description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-24 sm:px-8">
          <div className="overflow-hidden rounded-[30px] bg-paper px-6 py-10 text-white sm:px-10 lg:grid lg:grid-cols-[1fr_auto] lg:items-end lg:px-14 lg:py-14">
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8ef0c0]">The alpha contract</p>
              <h2 className="mt-4 max-w-3xl font-display text-4xl font-semibold leading-[.95] tracking-[-0.05em] sm:text-6xl">A smaller admitted context—with every exclusion visible.</h2>
              <p className="mt-5 max-w-2xl text-sm leading-6 text-[#bdcad8]">Token efficiency is the hypothesis. The alpha records factual usage, checks, and failures before making any whole-loop Savings claim.</p>
            </div>
            <Link href="/pricing" className="mt-8 inline-flex rounded-xl bg-[#8ef0c0] px-5 py-3.5 text-sm font-semibold text-[#14233b] transition hover:bg-white lg:mt-0">Request alpha access →</Link>
          </div>
        </section>
      </main>
    </MarketingShell>
  );
}

"use client";

import { useState } from "react";

import { frame } from "@/components/Datasheet";
import { MarketingShell } from "@/components/MarketingShell";
import { monoLabel, PageHeader } from "@/components/PageHeader";
import { WaitlistForm } from "@/components/WaitlistForm";
import { admissionGateNote, admissionHeadline } from "@/lib/admission-copy";

const alphaBoundaries = [
  "Self-serve Repo localization for every signed-in user",
  "Public JavaScript, TypeScript, and Python repositories",
  "Durable Included, Excluded, and Widened file evidence",
  "Isolated Sandbox execution with allowlisted checks",
  "Review-ready proposal with factual token usage",
  "No billing, private-Repo access, or external GitHub writes",
];

export function PricingContent({ selfServeOpen }: { selfServeOpen: boolean }) {
  const [showAccessForm, setShowAccessForm] = useState(false);
  const [headline, ...rest] = admissionHeadline(selfServeOpen).split(/(?<=\.)\s+/);

  return (
    <MarketingShell selfServeOpen={selfServeOpen}>
      <main>
        <PageHeader label="Public early access" title={headline ?? ""} subtitle={rest.join(" ") || undefined}>
          {admissionGateNote(selfServeOpen)}{" "}
          Create a free account to inspect a task-sized Slice for any supported public Repo.
          We are inviting a smaller group to test complete Agent Runs before introducing paid plans.
        </PageHeader>

        <section className={`${frame} pb-20 sm:pb-28`}>
          <div
            id="request-access"
            className="grid scroll-mt-24 overflow-hidden rounded-card border border-ink md:grid-cols-2"
          >
            <div className="bg-surface p-7 sm:p-10">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="font-display text-[34px] font-normal leading-none tracking-[-0.02em] text-ink">Included</h2>
                <span className={monoLabel}>Every account</span>
              </div>
              <ul className="mt-8 border-t border-line-2">
                {alphaBoundaries.map((boundary) => (
                  <li key={boundary} className="flex items-start gap-4 border-b border-line py-3.5 text-[15px] leading-6 text-ink-2">
                    <span aria-hidden className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-[1px] bg-included" />
                    {boundary}
                  </li>
                ))}
              </ul>
            </div>

            <div data-band="dark" className="@container flex flex-col bg-canvas p-7 text-ink sm:p-10">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p className={monoLabel}>Design-partner access</p>
                <span className="rounded-chip border border-line-2 px-2 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ink-2">
                  $0 during early access
                </span>
              </div>
              {/* Capped by the card's own width (11cqi): side by side at 768, the second line
                  only just fit in the serif and wrapped in the stand-in until it loaded. */}
              <h2 className="mt-8 font-display text-[length:min(clamp(32px,3.4vw,44px),11cqi)] font-normal leading-[1.04] tracking-[-0.02em] text-ink">
                One honest
                <span className="block text-muted">early-access contract.</span>
              </h2>
              <p className="mt-5 max-w-md text-[15px] leading-6 text-ink-2">
                Access is manually approved. No payment information is requested.
              </p>
              <div className="mt-auto pt-10">
                <button
                  type="button"
                  onClick={() => setShowAccessForm(true)}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-chip bg-ink px-5 text-[15px] font-medium text-canvas transition-[background-color,transform] duration-150 hover:bg-ink/88 active:scale-[0.97] sm:w-auto"
                >
                  Request Agent Run access <span aria-hidden="true">→</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
      {showAccessForm && <WaitlistForm onClose={() => setShowAccessForm(false)} />}
    </MarketingShell>
  );
}

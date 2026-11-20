"use client";

import { useState } from "react";

import { MarketingShell } from "@/components/MarketingShell";
import { WaitlistForm } from "@/components/WaitlistForm";
import { admissionGateNote, admissionHeadline } from "@/lib/admission-copy";
import { RiseWords } from "@/components/Reveal";

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

  return (
    <MarketingShell selfServeOpen={selfServeOpen}>
      <main className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="text-center">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-muted">
            Public early access
          </p>
          <RiseWords as="h1" onLoad lines={[admissionHeadline(selfServeOpen)]} className="mt-4 font-display text-4xl font-semibold tracking-[-0.04em] text-ink sm:text-6xl" />
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-ink-2 sm:text-lg">
            {admissionGateNote(selfServeOpen)}{" "}
            Create a free account to inspect a task-sized Slice for any supported public Repo.
            We are inviting a smaller group to test complete Agent Runs before introducing paid plans.
          </p>
        </div>

        <section id="request-access" className="mx-auto mt-8 max-w-3xl scroll-mt-24 rounded-card border border-included/35 bg-surface p-6 shadow-panel sm:p-9">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-muted">
                Design-partner access
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-ink">
                One honest early-access contract
              </h2>
            </div>
            <span className="rounded-full border border-line-2 bg-canvas px-3 py-1.5 text-xs font-semibold text-ink">
              $0 during early access
            </span>
          </div>

          <ul className="mt-7 space-y-3">
            {alphaBoundaries.map((boundary) => (
              <li key={boundary} className="flex items-start gap-3 text-sm leading-6 text-ink-2">
                <span aria-hidden className="mt-0.5 text-included">+</span>
                {boundary}
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => setShowAccessForm(true)}
            className="mt-8 w-full rounded-card bg-ink px-5 py-3.5 text-sm font-semibold text-canvas transition hover:bg-ink/90"
          >
            Request Agent Run access
          </button>
          <p className="mt-3 text-center text-xs leading-5 text-muted">
            Access is manually approved. No payment information is requested.
          </p>
        </section>
      </main>
      {showAccessForm && <WaitlistForm onClose={() => setShowAccessForm(false)} />}
    </MarketingShell>
  );
}

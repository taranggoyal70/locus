import type { Metadata } from "next";

import { MarketingShell } from "@/components/MarketingShell";
import { selfServeOpen } from "@/lib/admission";
import { supportAvailability } from "@/lib/admission-copy";
import { REPO_URL, SITE_URL } from "@/lib/config";

export const metadata: Metadata = {
  title: "Support and service status — Locus",
  description: "How to report a Locus problem, security issue, or data request.",
};

const issueUrl = `${REPO_URL}/issues/new`;
const securityUrl = `${REPO_URL}/security/advisories/new`;

export default function SupportPage() {
  return (
    <MarketingShell selfServeOpen={selfServeOpen()}>
      <main className="mx-auto max-w-4xl px-5 py-12">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-accent">Operations</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.05em] text-paper">Support and service status</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-light">
          {supportAvailability(selfServeOpen())}
          These are response targets, not guarantees, and external repository writes remain disabled.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-line-strong bg-surface p-5">
            <h2 className="text-lg font-semibold text-paper">Service status</h2>
            <p className="mt-2 text-sm leading-6 text-muted-light">
              Check the live revision and application readiness before reporting an outage.
            </p>
            <a href={`${SITE_URL}/api/health`} className="mt-4 inline-block text-sm font-semibold text-accent hover:underline">
              Open live health endpoint →
            </a>
          </section>
          <section className="rounded-2xl border border-line-strong bg-surface p-5">
            <h2 className="text-lg font-semibold text-paper">Product support</h2>
            <p className="mt-2 text-sm leading-6 text-muted-light">
              Report a reproducible bug without source code, credentials, personal data, or private task text.
            </p>
            <a href={issueUrl} className="mt-4 inline-block text-sm font-semibold text-accent hover:underline">
              Open a support issue →
            </a>
          </section>
        </div>

        <section className="mt-6 rounded-2xl border border-line-strong bg-surface p-5">
          <h2 className="text-lg font-semibold text-paper">Incident severity</h2>
          <div className="mt-4 grid gap-3 text-sm leading-6 text-muted-light sm:grid-cols-3">
            <div><strong className="block text-paper">Critical · 4 hours</strong>Confirmed data exposure, destructive behavior, or total service loss.</div>
            <div><strong className="block text-paper">High · 1 business day</strong>Agent Runs broadly fail or review evidence is unavailable.</div>
            <div><strong className="block text-paper">Normal · 3 business days</strong>Isolated defects, questions, and product feedback.</div>
          </div>
        </section>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-line-strong bg-surface p-5">
            <h2 className="text-lg font-semibold text-paper">Security reports</h2>
            <p className="mt-2 text-sm leading-6 text-muted-light">
              Do not open a public issue for a vulnerability. Use a private GitHub Security Advisory.
            </p>
            <a href={securityUrl} className="mt-4 inline-block text-sm font-semibold text-accent hover:underline">
              Start a private advisory →
            </a>
          </section>
          <section className="rounded-2xl border border-line-strong bg-surface p-5">
            <h2 className="text-lg font-semibold text-paper">Data deletion</h2>
            <p className="mt-2 text-sm leading-6 text-muted-light">
              Request early deletion with your account identifier only. Never paste source, task evidence, or credentials.
            </p>
            <a href={issueUrl} className="mt-4 inline-block text-sm font-semibold text-accent hover:underline">
              Request deletion →
            </a>
          </section>
        </div>
      </main>
    </MarketingShell>
  );
}

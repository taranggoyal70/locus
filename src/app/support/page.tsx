import type { Metadata } from "next";

import { MarketingShell } from "@/components/MarketingShell";
import { selfServeOpen } from "@/lib/admission";
import { supportAvailability } from "@/lib/admission-copy";
import { SITE_URL, SUPPORT_URL } from "@/lib/config";
import { frame, Rule, SectionLabel } from "@/components/Datasheet";
import { inkLink, monoLabel, PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "Support and service status · Locus",
  description: "How to report a Locus problem, security issue, or data request.",
};

const sectionGrid = "grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10";

const issueUrl = `${SUPPORT_URL}/issues/new`;
const securityUrl = `${SUPPORT_URL}/security/advisories/new`;

const CHANNELS = [
  {
    title: "Service status",
    body: "Check the live revision and application readiness before reporting an outage.",
    href: `${SITE_URL}/api/health`,
    action: "Open live health endpoint",
  },
  {
    title: "Product support",
    body: "Report a reproducible bug without source code, credentials, personal data, or private task text.",
    href: issueUrl,
    action: "Open a support issue",
  },
  {
    title: "Security reports",
    body: "Do not open a public issue for a vulnerability. Use a private GitHub Security Advisory.",
    href: securityUrl,
    action: "Start a private advisory",
  },
  {
    title: "Data deletion",
    body: "Request early deletion with your account identifier only. Never paste source, task evidence, or credentials.",
    href: issueUrl,
    action: "Request deletion",
  },
];

const SEVERITY = [
  ["Critical", "4 hours", "Confirmed data exposure, destructive behavior, or total service loss."],
  ["High", "1 business day", "Agent Runs broadly fail or review evidence is unavailable."],
  ["Normal", "3 business days", "Isolated defects, questions, and product feedback."],
] as const;

export default function SupportPage() {
  const open = selfServeOpen();
  return (
    <MarketingShell selfServeOpen={open}>
      <main>
        <PageHeader label="Operations" title="Support and" subtitle="service status.">
          {supportAvailability(open)}
          {" "}Shared Agent Run capacity resets daily at 00:00 UTC; connected Cloudflare accounts
          use their own limits. These are response targets, not guarantees, and external repository
          writes remain disabled.
        </PageHeader>

        <Rule />

        <section className={`${frame} py-14 sm:py-20`}>
          <div className={sectionGrid}>
            <SectionLabel n="01" label="Channels" />
            <ol className="border-t border-ink">
              {CHANNELS.map((channel, index) => (
                <li key={channel.title} className="grid gap-2 border-b border-line-2 py-6 sm:grid-cols-[40px_220px_minmax(0,1fr)_auto] sm:items-baseline sm:gap-5">
                  <span className="font-mono text-[11px] text-muted tabular-nums">0{index + 1}</span>
                  <h2 className="font-display text-[26px] font-normal leading-tight tracking-[-0.015em] text-ink">{channel.title}</h2>
                  <p className="max-w-xl text-[15px] leading-6 text-ink-2">{channel.body}</p>
                  <a href={channel.href} className={`whitespace-nowrap text-[14px] ${inkLink}`}>
                    {channel.action} <span aria-hidden="true">↗</span>
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <Rule />

        <section className={`${frame} py-14 sm:py-20`}>
          <div className={sectionGrid}>
            <SectionLabel n="02" label="Incident severity" />
            <div>
              <h2 className="sr-only">Incident severity</h2>
              <dl className="grid border-t border-ink sm:grid-cols-3">
                {SEVERITY.map(([level, target, meaning], index) => (
                  <div key={level} className={`border-b border-line-2 py-6 sm:border-b-0 ${index > 0 ? "sm:border-l sm:border-line sm:pl-6" : ""} sm:pr-6`}>
                    <dt className={monoLabel}>{level}</dt>
                    <dd className="mt-3 font-display text-[34px] font-normal leading-none tracking-[-0.02em] text-ink tabular-nums">{target}</dd>
                    <dd className="mt-3 text-[15px] leading-6 text-ink-2">{meaning}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-5 font-mono text-[11px] leading-5 text-muted">Response targets, not guarantees.</p>
            </div>
          </div>
        </section>
      </main>
    </MarketingShell>
  );
}

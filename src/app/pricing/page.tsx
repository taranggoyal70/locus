"use client";

import Link from "next/link";
import { useState } from "react";

import { MarketingShell } from "@/components/MarketingShell";
import { WaitlistForm } from "@/components/WaitlistForm";

const tiers = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "For developers who want a smaller, accountable agent loop.",
    features: [
      "Public repositories",
      "10 Agent Runs per day",
      "Durable run history and resume",
      "Included and excluded file evidence",
      "Verified-only token savings",
      "CLI + MCP server",
      "5 API keys",
      "30 API calls / minute",
    ],
    cta: "Get started",
    ctaHref: "/sign-up",
    action: "link" as const,
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/ month",
    description: "For teams ready to move the full engineering loop into Locus.",
    features: [
      "Everything in Free",
      "Private repositories (GitHub OAuth)",
      "Higher Agent Run limits",
      "Shared runs and evidence",
      "10 API keys",
      "120 API calls / minute",
      "Team workspaces",
      "Usage analytics dashboard",
      "Priority support",
    ],
    cta: "Join waitlist",
    ctaHref: "",
    action: "waitlist" as const,
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For organizations with compliance and scale needs.",
    features: [
      "Everything in Pro",
      "Self-hosted option",
      "SSO / SAML",
      "Audit logs",
      "Custom rate limits",
      "Dedicated support",
      "SLA guarantee",
    ],
    cta: "Contact us",
    ctaHref: "mailto:intern@gohighview.com",
    action: "link" as const,
    highlighted: false,
  },
];

export default function PricingPage() {
  const [showWaitlist, setShowWaitlist] = useState(false);

  return (
    <MarketingShell>
      <main className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="text-center">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-accent">Pricing</p>
          <h1 className="mt-4 font-display text-4xl font-semibold tracking-[-0.05em] text-paper sm:text-6xl">
            Pay for throughput, not promises.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted-light sm:text-lg">
            Start with public repositories and ten end-to-end Agent Runs a day. Every plan keeps the same rule: savings count only after verification passes.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`rounded-[22px] border p-6 ${
                tier.highlighted
                  ? "border-accent/45 bg-[#e2eee8] shadow-[0_24px_70px_rgba(20,35,59,0.10)]"
                  : "border-line-strong bg-surface/80"
              }`}
            >
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-accent">{tier.name}</p>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-semibold tracking-[-0.04em] text-paper">{tier.price}</span>
                {tier.period && <span className="text-sm text-muted">{tier.period}</span>}
              </div>
              <p className="mt-2 text-sm text-muted-light">{tier.description}</p>

              <ul className="mt-6 space-y-2.5">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-muted-light">
                    <span className="mt-0.5 text-accent">+</span>
                    {feature}
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                {tier.action === "waitlist" ? (
                  <button
                    onClick={() => setShowWaitlist(true)}
                    className="block w-full rounded-xl bg-accent px-4 py-3 text-center text-sm font-semibold text-ink transition hover:bg-accent-dim"
                  >
                    {tier.cta}
                  </button>
                ) : (
                  <Link
                    href={tier.ctaHref}
                    className={`block w-full rounded-xl px-4 py-3 text-center text-sm font-semibold transition ${
                      tier.highlighted
                        ? "bg-accent text-ink hover:bg-accent-dim"
                        : "border border-line-strong text-paper hover:border-accent/40"
                    }`}
                  >
                    {tier.cta}
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <p className="text-sm text-muted-light">
            Need something specific?{" "}
            <a href="mailto:intern@gohighview.com" className="text-accent hover:underline">
              Get in touch
            </a>
          </p>
        </div>
      </main>
      {showWaitlist && <WaitlistForm onClose={() => setShowWaitlist(false)} />}
    </MarketingShell>
  );
}

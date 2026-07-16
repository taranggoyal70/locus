import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pricing — Locus",
  description: "Start free with public repos. Upgrade for private repos, team workspaces, and higher API limits.",
};

const tiers = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "For individual developers exploring Locus.",
    features: [
      "Public repositories",
      "Unlimited browser analyses",
      "CLI + MCP server",
      "3 saved analyses",
      "2 API keys",
      "30 API calls / minute",
      "Community support",
    ],
    cta: "Get started",
    ctaHref: "/sign-up",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/ month",
    description: "For teams shipping with AI agents every day.",
    features: [
      "Everything in Free",
      "Private repositories (GitHub OAuth)",
      "Unlimited saved analyses",
      "10 API keys",
      "120 API calls / minute",
      "Team workspaces",
      "Priority support",
      "Usage analytics dashboard",
    ],
    cta: "Coming soon",
    ctaHref: null,
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
    highlighted: false,
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-ink/[0.88] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 sm:px-8">
          <Link href="/" className="flex items-center gap-3 text-paper">
            <Image src="/locus-mark.svg" width={28} height={28} alt="" priority />
            <span className="font-semibold tracking-[-0.02em]">Locus</span>
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/docs" className="rounded-lg px-3 py-2 text-muted-light transition hover:text-paper">Docs</Link>
            <Link href="/pricing" className="rounded-lg px-3 py-2 text-accent font-medium">Pricing</Link>
            <Link href="/workspace" className="rounded-lg border border-accent/30 bg-accent/[0.06] px-3 py-2 font-medium text-accent transition hover:bg-accent/[0.1]">
              Open workspace
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="text-center">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-accent">Pricing</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-paper sm:text-5xl">
            Start free. Scale when you&apos;re ready.
          </h1>
          <p className="mt-4 text-base text-muted-light sm:text-lg">
            Locus is free for public repositories. Upgrade for private repos, team features, and higher API limits.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`rounded-[22px] border p-6 ${
                tier.highlighted
                  ? "border-accent/40 bg-accent/[0.03] shadow-[0_0_60px_rgba(163,230,53,0.06)]"
                  : "border-line-strong bg-surface"
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
                {tier.ctaHref ? (
                  <Link
                    href={tier.ctaHref}
                    className={`block w-full rounded-xl px-4 py-3 text-center text-sm font-semibold transition ${
                      tier.highlighted
                        ? "bg-accent text-ink hover:bg-[#b5f34a]"
                        : "border border-line-strong text-paper hover:border-accent/40"
                    }`}
                  >
                    {tier.cta}
                  </Link>
                ) : (
                  <span className="block w-full rounded-xl border border-line px-4 py-3 text-center text-sm font-medium text-muted">
                    {tier.cta}
                  </span>
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
    </div>
  );
}

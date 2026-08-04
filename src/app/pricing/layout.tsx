import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — Locus",
  description: "Request access to the invite-only Locus controlled alpha for public-Repo, review-ready Agent Runs.",
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}

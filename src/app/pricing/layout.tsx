import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — Locus",
  description: "Start with ten verified Agent Runs a day. Upgrade for private repos, team workflows, and higher throughput.",
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}

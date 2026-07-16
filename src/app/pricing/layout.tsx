import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — Locus",
  description: "Start free with public repos. Upgrade for private repos, team workspaces, and higher API limits.",
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}

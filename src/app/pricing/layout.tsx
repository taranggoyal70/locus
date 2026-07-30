import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — Locus",
  description: "Use Locus free for public repositories and join the waitlist for planned Pro features.",
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}

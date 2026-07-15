import type { Metadata } from "next";

import { LocusApp } from "@/components/LocusApp";

export const metadata: Metadata = {
  title: "Locus demo · Task-sized context for coding agents",
  description: "Try the public Locus context compiler demo.",
};

export default function DemoPage() {
  return <LocusApp />;
}

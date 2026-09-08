import type { Metadata } from "next";

import { MarketingShell } from "@/components/MarketingShell";
import { selfServeOpen } from "@/lib/admission";
import { MigrationDemo } from "@/components/MigrationDemo";

export const metadata: Metadata = {
  title: "Locus Guard interactive demo",
  description: "See how Locus contains an AI coding task to approved Repo files and signs candidate, Check, usage, and Review evidence.",
};

export default function DemoPage() {
  return (
    <MarketingShell selfServeOpen={selfServeOpen()}>
      <main>
        <MigrationDemo selfServeOpen={selfServeOpen()} />
      </main>
    </MarketingShell>
  );
}

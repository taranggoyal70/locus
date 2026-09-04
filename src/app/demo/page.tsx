import type { Metadata } from "next";

import { MarketingShell } from "@/components/MarketingShell";
import { selfServeOpen } from "@/lib/admission";
import { MigrationDemo } from "@/components/MigrationDemo";

export const metadata: Metadata = {
  title: "API migration vision demo — Locus",
  description: "See Locus's proposed provider-sponsored API migration workflow in a clearly labeled interactive simulation.",
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

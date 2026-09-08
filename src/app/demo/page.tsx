import type { Metadata } from "next";

import { MarketingShell } from "@/components/MarketingShell";
import { selfServeOpen } from "@/lib/admission";
import { MigrationDemo } from "@/components/MigrationDemo";

export const metadata: Metadata = {
  title: "Locus Guard interactive demo",
  description: "See how Locus turns an AI coding task into an approved file boundary and candidate-bound Guard receipt.",
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

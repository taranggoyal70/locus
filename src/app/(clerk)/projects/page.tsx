import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AgentRunsList } from "@/components/AgentRunsList";
import { AppShell } from "@/components/AppShell";
import { frame, Rule } from "@/components/Datasheet";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "Agent Runs · Locus",
};

export default async function ProjectsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <AppShell>
      <main>
        <PageHeader app label="Evidence ledger" title="Agent Runs">
          Resume active work and inspect factual Slice, Step, check, failure, and token evidence.
        </PageHeader>
        <Rule />
        <div className={`${frame} py-10 sm:py-14`}>
          <AgentRunsList />
        </div>
      </main>
    </AppShell>
  );
}

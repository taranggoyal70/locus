import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { AgentRunsList } from "@/components/AgentRunsList";
import { SettingsShell } from "@/components/SettingsShell";

export default async function ProjectsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <SettingsShell>
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-accent">Evidence ledger</p>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.05em] text-paper">Agent Runs</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-light">
        Resume active work and inspect factual Slice, Step, check, failure, and token evidence.
      </p>
      <div className="aperture-rule mt-7" />
      <div className="mt-7">
        <AgentRunsList />
      </div>
    </SettingsShell>
  );
}

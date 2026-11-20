import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { AgentRunsList } from "@/components/AgentRunsList";
import { SettingsShell } from "@/components/SettingsShell";

export default async function ProjectsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <SettingsShell>
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-muted">Evidence ledger</p>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.04em] text-ink">Agent Runs</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-2">
        Resume active work and inspect factual Slice, Step, check, failure, and token evidence.
      </p>
      <div className="mt-7 border-t border-line" />
      <div className="mt-7">
        <AgentRunsList />
      </div>
    </SettingsShell>
  );
}

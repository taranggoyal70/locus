import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { AgentRunsList } from "@/components/AgentRunsList";
import { SettingsShell } from "@/components/SettingsShell";

export default async function ProjectsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <SettingsShell>
      <h1 className="text-2xl font-semibold tracking-[-0.03em] text-paper">Agent Runs</h1>
      <p className="mt-1 text-sm text-muted-light">
        Resume active work, review failures, approve delivery, and inspect verified token savings.
      </p>
      <div className="mt-6">
        <AgentRunsList />
      </div>
    </SettingsShell>
  );
}

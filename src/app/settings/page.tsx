import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { ApiKeysPanel } from "@/components/ApiKeysPanel";
import { SettingsShell } from "@/components/SettingsShell";
import { UsageStats } from "@/components/UsageStats";

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <SettingsShell>
      <h1 className="text-2xl font-semibold tracking-[-0.03em] text-paper">Settings</h1>
      <div className="mt-8 space-y-10">
        <section>
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-paper">Usage</h2>
          <p className="mt-1 text-sm text-muted-light">Your activity over the last 30 days.</p>
          <div className="mt-4">
            <UsageStats />
          </div>
        </section>
        <section>
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-paper">API Keys</h2>
          <p className="mt-1 text-sm text-muted-light">
            Create keys to access the Locus API from your tools and agents.
          </p>
          <div className="mt-4">
            <ApiKeysPanel />
          </div>
        </section>
      </div>
    </SettingsShell>
  );
}

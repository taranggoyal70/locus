import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { ApiKeysPanel } from "@/components/ApiKeysPanel";
import { BillingPanel } from "@/components/BillingPanel";
import { GitHubConnectionPanel } from "@/components/GitHubConnectionPanel";
import { SettingsShell } from "@/components/SettingsShell";
import { TeamsPanel } from "@/components/TeamsPanel";
import { UsageStats } from "@/components/UsageStats";

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <SettingsShell>
      <h1 className="text-2xl font-semibold tracking-[-0.03em] text-paper">Settings</h1>
      <div className="mt-8 space-y-10">
        <section>
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-paper">Billing</h2>
          <p className="mt-1 text-sm text-muted-light">Manage your subscription and billing details.</p>
          <div className="mt-4">
            <BillingPanel />
          </div>
        </section>
        <section>
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-paper">GitHub</h2>
          <p className="mt-1 text-sm text-muted-light">
            Connect your GitHub account to analyze private repositories.
          </p>
          <div className="mt-4">
            <GitHubConnectionPanel />
          </div>
        </section>
        <section>
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-paper">Teams</h2>
          <p className="mt-1 text-sm text-muted-light">
            Create teams to share projects and analyses with your colleagues.
          </p>
          <div className="mt-4">
            <TeamsPanel />
          </div>
        </section>
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

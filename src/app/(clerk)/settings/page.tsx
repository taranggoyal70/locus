import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { AccountEmailPanel } from "@/components/AccountEmailPanel";
import { AlphaSettingsNotice } from "@/components/AlphaSettingsNotice";
import { ApiKeysPanel } from "@/components/ApiKeysPanel";
import { CloudflareConnectionPanel } from "@/components/CloudflareConnectionPanel";
import { ProjectsList } from "@/components/ProjectsList";
import { SettingsShell } from "@/components/SettingsShell";
import { admissionForAccount } from "@/lib/admission-server";
import { UsageStats } from "@/components/UsageStats";

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [user, admission] = await Promise.all([
    currentUser(),
    admissionForAccount(userId),
  ]);
  const primaryEmail = user?.primaryEmailAddress;

  return (
    <SettingsShell>
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-muted">Control plane</p>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.04em] text-ink">Settings</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-2">Connections, limits, and credentials for your agent workspace.</p>
      <div className="mt-7 border-t border-line" />
      <div className="mt-8 space-y-10">
        <AlphaSettingsNotice tier={admission.tier} />
        <AccountEmailPanel
          email={primaryEmail?.emailAddress ?? null}
          verified={primaryEmail?.verification?.status === "verified"}
        />
        {/* BYOK capacity, from the free-beta branch: an account that has used the
            shared daily Run can connect its own Cloudflare account and continue. */}
        <CloudflareConnectionPanel />
        <section>
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-ink">Agent capacity</h2>
          <p className="mt-1 text-sm text-ink-2">Prepare a Cloudflare connection, or use shared capacity when Agent access is enabled.</p>
          <div className="mt-4">
            <CloudflareConnectionPanel />
          </div>
        </section>
        <section>
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-ink">Usage</h2>
          <p className="mt-1 text-sm text-ink-2">Your Agent Run and API activity over the last 30 days.</p>
          <div className="mt-4">
            <UsageStats />
          </div>
        </section>
        <section>
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-ink">Saved analyses</h2>
          <p className="mt-1 text-sm text-ink-2">
            Slices you saved from the workspace. Opening one restores its Repo and task.
          </p>
          <div className="mt-4">
            <ProjectsList />
          </div>
        </section>
        <section>
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-ink">API Keys</h2>
          <p className="mt-1 text-sm text-ink-2">
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

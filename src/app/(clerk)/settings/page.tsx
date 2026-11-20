import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { AccountEmailPanel } from "@/components/AccountEmailPanel";
import { AlphaSettingsNotice } from "@/components/AlphaSettingsNotice";
import { ApiKeysPanel } from "@/components/ApiKeysPanel";
import { CloudflareConnectionPanel } from "@/components/CloudflareConnectionPanel";
import { ProjectsList } from "@/components/ProjectsList";
import { SettingsShell } from "@/components/SettingsShell";
import { ThemeSwitch } from "@/components/ThemeSwitch";
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
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Control plane</p>
      <h1 className="mt-4 font-display text-[clamp(40px,5vw,60px)] font-normal leading-none tracking-[-0.02em] text-ink">Settings</h1>
      <p className="mt-4 max-w-2xl text-[16px] leading-7 text-ink-2">Connections, limits, and credentials for your agent workspace.</p>
      <div className="mt-8 border-t border-ink" />
      <div className="mt-8 space-y-10">
        <AlphaSettingsNotice tier={admission.tier} />
        <AccountEmailPanel
          email={primaryEmail?.emailAddress ?? null}
          verified={primaryEmail?.verification?.status === "verified"}
        />
        {/* BYOK capacity: an account that has used the shared daily Run can
            connect its own Cloudflare account and continue. */}
        <section className="border-t border-line pt-8">
          <h2 className="font-display text-[28px] font-normal leading-tight tracking-[-0.015em] text-ink">Agent capacity</h2>
          <p className="mt-1 text-sm text-ink-2">Prepare a Cloudflare connection, or use shared capacity when Agent access is enabled.</p>
          <div className="mt-4">
            <CloudflareConnectionPanel />
          </div>
        </section>
        <section className="border-t border-line pt-8">
          <h2 className="font-display text-[28px] font-normal leading-tight tracking-[-0.015em] text-ink">Usage</h2>
          <p className="mt-1 text-sm text-ink-2">Your Agent Run and API activity over the last 30 days.</p>
          <div className="mt-4">
            <UsageStats />
          </div>
        </section>
        <section className="border-t border-line pt-8">
          <h2 className="font-display text-[28px] font-normal leading-tight tracking-[-0.015em] text-ink">Saved analyses</h2>
          <p className="mt-1 text-sm text-ink-2">
            Slices you saved from the workspace. Opening one restores its Repo and task.
          </p>
          <div className="mt-4">
            <ProjectsList />
          </div>
        </section>
        <section className="border-t border-line pt-8">
          <h2 className="font-display text-[28px] font-normal leading-tight tracking-[-0.015em] text-ink">API Keys</h2>
          <p className="mt-1 text-sm text-ink-2">
            Create keys to access the Locus API from your tools and agents.
          </p>
          <div className="mt-4">
            <ApiKeysPanel />
          </div>
        </section>
        <section className="border-t border-line pt-8">
          <h2 className="font-display text-[28px] font-normal leading-tight tracking-[-0.015em] text-ink">Appearance</h2>
          <p className="mt-1 text-sm text-ink-2">Follow the system setting, or pin Locus to light or dark on this device.</p>
          <div className="mt-4">
            <ThemeSwitch />
          </div>
        </section>
      </div>
    </SettingsShell>
  );
}

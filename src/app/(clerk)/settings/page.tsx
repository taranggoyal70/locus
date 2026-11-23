import { auth, currentUser } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AccountEmailPanel } from "@/components/AccountEmailPanel";
import { AlphaSettingsNotice } from "@/components/AlphaSettingsNotice";
import { ApiKeysPanel } from "@/components/ApiKeysPanel";
import { AppShell } from "@/components/AppShell";
import { CloudflareConnectionPanel } from "@/components/CloudflareConnectionPanel";
import { frame, Rule, SheetSection } from "@/components/Datasheet";
import { PageHeader } from "@/components/PageHeader";
import { ProjectsList } from "@/components/ProjectsList";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { admissionForAccount } from "@/lib/admission-server";
import { UsageStats } from "@/components/UsageStats";

export const metadata: Metadata = {
  title: "Settings · Locus",
};

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [user, admission] = await Promise.all([
    currentUser(),
    admissionForAccount(userId),
  ]);
  const primaryEmail = user?.primaryEmailAddress;

  return (
    <AppShell>
      <main>
        <PageHeader app label="Control plane" title="Settings">
          Connections, limits, and credentials for your agent workspace.
        </PageHeader>

        {/* Where the account stands, before anything it can change. */}
        <div className={`${frame} grid gap-4 pb-12 sm:pb-16 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]`}>
          <AlphaSettingsNotice tier={admission.tier} />
          <AccountEmailPanel
            email={primaryEmail?.emailAddress ?? null}
            verified={primaryEmail?.verification?.status === "verified"}
          />
        </div>

        <Rule />
        {/* BYOK capacity: an account that has used the shared daily Run can
            connect its own Cloudflare account and continue. */}
        <SheetSection
          id="capacity"
          n="01"
          label="Capacity"
          title="Agent capacity"
          description="Prepare a Cloudflare connection, or use shared capacity when Agent access is enabled."
        >
          <CloudflareConnectionPanel />
        </SheetSection>

        <Rule />
        <SheetSection id="usage" n="02" label="Usage" title="Usage" description="Your Agent Run and API activity over the last 30 days.">
          <UsageStats />
        </SheetSection>

        <Rule />
        <SheetSection
          id="saved"
          n="03"
          label="Saved"
          title="Saved analyses"
          description="Slices you saved from the workspace. Opening one restores its Repo and task."
        >
          <ProjectsList />
        </SheetSection>

        <Rule />
        <SheetSection
          id="api-keys"
          n="04"
          label="API"
          title="API Keys"
          description="Create keys to access the Locus API from your tools and agents."
        >
          <ApiKeysPanel />
        </SheetSection>

        <Rule />
        <SheetSection
          id="appearance"
          n="05"
          label="Appearance"
          title="Appearance"
          description="Follow the system setting, or pin Locus to light or dark on this device."
        >
          <ThemeSwitch />
        </SheetSection>
      </main>
    </AppShell>
  );
}

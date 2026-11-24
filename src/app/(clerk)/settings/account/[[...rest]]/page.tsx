import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ThemedUserProfile } from "@/components/ClerkThemed";
import { AppShell } from "@/components/AppShell";
import { frame, Rule } from "@/components/Datasheet";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "Account · Locus",
  description: "Manage your Locus account, email addresses, and security settings.",
};

/**
 * The account surface Clerk owns.
 *
 * It exists because self-serve admission requires a verified email address and
 * the product had nowhere to verify one. Telling somebody to verify their email
 * and then handing them a page with no way to do it is the same dead end as a
 * refusal on a disabled button.
 *
 * A catch-all segment is required: Clerk routes its own sub-pages (email
 * addresses, security, connected accounts) underneath this path, and without it
 * every one of them 404s.
 */
export default async function AccountSettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <AppShell>
      <main>
        <PageHeader app label="Account" title="Your account">
          Email addresses, password, and connected accounts. A verified email address
          is required to start Agent Runs.
        </PageHeader>
        <Rule />
        <div className={`${frame} py-10 sm:py-14`}>
          <ThemedUserProfile path="/settings/account" />
        </div>
      </main>
    </AppShell>
  );
}

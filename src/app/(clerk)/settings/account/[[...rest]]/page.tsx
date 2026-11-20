import { UserProfile } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SettingsShell } from "@/components/SettingsShell";

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
    <SettingsShell>
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-muted">
        Account
      </p>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.04em] text-ink">
        Your account
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-2">
        Email addresses, password, and connected accounts. A verified email address
        is required to start Agent Runs.
      </p>
      <div className="mt-7 border-t border-line" />
      <div className="mt-8">
        <UserProfile
          path="/settings/account"
          routing="path"
          appearance={{ elements: { rootBox: "w-full", cardBox: "w-full shadow-none" } }}
        />
      </div>
    </SettingsShell>
  );
}

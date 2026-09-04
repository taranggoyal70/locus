import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";

import { AUTH_APPEARANCE, AuthLoading, AuthShell } from "@/components/AuthShell";
import { runQuotaForTier, selfServeOpen } from "@/lib/admission";

export const metadata: Metadata = {
  title: "Create an account · Locus",
  description: "Create a free Locus account and open your workspace.",
};

export default function SignUpPage() {
  // Read at render, not baked in. This sentence is a promise to someone who has
  // not signed up yet, and it was wrong for every account the moment self-serve
  // opened.
  const daily = runQuotaForTier("free").maxDailyRuns;
  const description = selfServeOpen()
    ? `Create a free account and localize a real TypeScript or Next.js task. Agent Runs are included, ${daily} per day.`
    : "Create a free account and localize a real TypeScript or Next.js task. Agent Runs are available to invited design partners.";

  return (
    <AuthShell
      eyebrow="Create your workspace"
      title="Start with the files that matter."
      description={description}
    >
      <SignUp
        appearance={AUTH_APPEARANCE}
        fallback={<AuthLoading label="Preparing account creation" />}
        path="/sign-up"
        routing="path"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/workspace"
      />
    </AuthShell>
  );
}

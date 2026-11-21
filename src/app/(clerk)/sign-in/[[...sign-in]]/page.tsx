import type { Metadata } from "next";

import { AuthLoading, AuthShell } from "@/components/AuthShell";
import { ThemedSignIn } from "@/components/ClerkThemed";
import { selfServeOpen } from "@/lib/admission";
import { signInDescription } from "@/lib/admission-copy";

export const metadata: Metadata = {
  title: "Log in · Locus",
  description: "Log in to your Locus workspace.",
};

export default function SignInPage() {
  const description = signInDescription(selfServeOpen());

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Pick up with less noise."
      description={description}
    >
      <ThemedSignIn
        fallback={<AuthLoading label="Loading your account" />}
        path="/sign-in"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/workspace"
      />
    </AuthShell>
  );
}

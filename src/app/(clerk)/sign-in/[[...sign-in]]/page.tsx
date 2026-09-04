import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";

import { AUTH_APPEARANCE, AuthLoading, AuthShell } from "@/components/AuthShell";
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
      <SignIn
        appearance={AUTH_APPEARANCE}
        fallback={<AuthLoading label="Loading your account" />}
        path="/sign-in"
        routing="path"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/workspace"
      />
    </AuthShell>
  );
}

import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";

import { AUTH_APPEARANCE, AuthLoading, AuthShell } from "@/components/AuthShell";
import { selfServeOpen } from "@/lib/admission";

export const metadata: Metadata = {
  title: "Log in · Locus",
  description: "Log in to your Locus workspace.",
};

export default function SignInPage() {
  const description = selfServeOpen()
    ? "Sign in to localize a public Repo, inspect visible context evidence, or resume an Agent Run."
    : "Sign in to localize a public Repo, inspect visible context evidence, or resume an invited Agent Run.";

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

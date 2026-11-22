import type { Metadata } from "next";

import { AuthLoading, AuthShell } from "@/components/AuthShell";
import { ThemedSignUp } from "@/components/ClerkThemed";
import { selfServeOpen } from "@/lib/admission";
import { signUpDescription } from "@/lib/admission-copy";

export const metadata: Metadata = {
  title: "Create an account · Locus",
  description: "Create a free Locus account and open your workspace.",
};

export default function SignUpPage() {
  const description = signUpDescription(selfServeOpen());

  return (
    <AuthShell
      eyebrow="Create your workspace"
      title="Start with the files that matter."
      description={description}
    >
      <ThemedSignUp
        fallback={<AuthLoading label="Preparing account creation" />}
        path="/sign-up"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/workspace"
      />
    </AuthShell>
  );
}

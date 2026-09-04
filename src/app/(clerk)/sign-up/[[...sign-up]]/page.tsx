import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";

import { AUTH_APPEARANCE, AuthLoading, AuthShell } from "@/components/AuthShell";
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

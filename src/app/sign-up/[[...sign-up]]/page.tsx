import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";

import { AUTH_APPEARANCE, AuthLoading, AuthShell } from "@/components/AuthShell";

export const metadata: Metadata = {
  title: "Create an account · Locus",
  description: "Create a free Locus account and open your workspace.",
};

export default function SignUpPage() {
  return (
    <AuthShell
      eyebrow="Create your workspace"
      title="Start with the files that matter."
      description="Create a free account, bring a real TypeScript or Next.js task, and follow it from focused context to review-ready evidence."
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

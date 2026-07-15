import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";

import { AuthLoading, AuthShell } from "@/components/AuthShell";

export const metadata: Metadata = {
  title: "Log in · Locus",
  description: "Log in to your Locus workspace.",
};

const appearance = {
  variables: {
    colorPrimary: "#a3e635",
    colorBackground: "#11161a",
    colorInputBackground: "#0a0d0f",
    colorInputText: "#e9f0f2",
    colorText: "#e9f0f2",
    colorTextSecondary: "#a4b2ba",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "w-full shadow-none",
    card: "w-full border border-line-strong bg-surface shadow-[0_40px_120px_rgba(0,0,0,0.32)]",
    headerTitle: "text-paper",
    headerSubtitle: "text-muted-light",
    socialButtonsBlockButton: "border-line-strong bg-ink text-paper hover:bg-surface-raised",
    formFieldInput: "border-line-strong bg-ink text-paper",
    formButtonPrimary: "bg-accent text-ink hover:bg-[#b5f34a]",
    footerActionLink: "text-accent hover:text-accent",
    dividerLine: "bg-line-strong",
    dividerText: "text-muted",
  },
} as const;

export default function SignInPage() {
  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Pick up with less noise."
      description="Sign in to open your Locus workspace and build focused context packs for real engineering tasks."
    >
      <SignIn
        appearance={appearance}
        fallback={<AuthLoading label="Loading your account" />}
        path="/sign-in"
        routing="path"
        signUpUrl="/sign-up"
        forceRedirectUrl="/workspace"
      />
    </AuthShell>
  );
}

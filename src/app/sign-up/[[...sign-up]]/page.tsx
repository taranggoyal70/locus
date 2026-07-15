import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";

import { AuthShell } from "@/components/AuthShell";

export const metadata: Metadata = {
  title: "Create an account · Locus",
  description: "Create a free Locus account and open your workspace.",
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

export default function SignUpPage() {
  return (
    <AuthShell
      eyebrow="Create your workspace"
      title="Start with the files that matter."
      description="Create a free account, bring a real TypeScript or Next.js task, and see what your coding agent should read first."
    >
      <SignUp
        appearance={appearance}
        path="/sign-up"
        routing="path"
        signInUrl="/sign-in"
        forceRedirectUrl="/workspace"
      />
    </AuthShell>
  );
}

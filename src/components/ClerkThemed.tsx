"use client";

import { SignIn, SignUp, UserButton, UserProfile } from "@clerk/nextjs";
import type { ReactNode } from "react";

import { useResolvedTheme } from "@/hooks/useResolvedTheme";
import { CLERK_PALETTE } from "@/lib/clerk-palette";

const ELEMENTS = {
  rootBox: "w-full",
  cardBox: "w-full rounded-card border border-ink shadow-none",
  card: "w-full bg-surface shadow-none",
  headerTitle: "font-display text-[26px] font-normal tracking-[-0.015em] text-ink",
  headerSubtitle: "text-ink-2",
  socialButtonsBlockButton: "rounded-chip bg-canvas text-ink hover:bg-surface-2",
  formFieldLabel: "text-ink-2",
  // Clerk draws input rings with box-shadow (including its error ring), so only
  // the fill and shape change here.
  formFieldInput: "rounded-chip bg-canvas text-ink",
  // after:hidden removes Clerk's highlight overlay, which would tint the ink.
  formButtonPrimary: "rounded-chip bg-ink text-canvas shadow-none after:hidden hover:bg-ink/90",
  footer: "bg-none bg-canvas-2",
  footerActionText: "text-ink-2",
  footerActionLink: "text-ink underline decoration-line-2 underline-offset-4 hover:decoration-ink",
  dividerLine: "bg-line-2",
  dividerText: "text-muted",
  avatarBox: "h-8 w-8 border border-line-2",
  userButtonPopoverCard: "rounded-card border border-line-2 bg-surface text-ink shadow-panel",
  navbar: "bg-canvas-2",
  scrollBox: "bg-surface",
} as const;

function useAppearance() {
  const theme = useResolvedTheme();
  return { variables: { ...CLERK_PALETTE[theme], borderRadius: "4px", fontFamily: "var(--font-geist-sans)" }, elements: ELEMENTS };
}

type AuthCardProps = {
  path: string;
  fallback: ReactNode;
  fallbackRedirectUrl: string;
};

export function ThemedSignIn({ signUpUrl, ...props }: AuthCardProps & { signUpUrl: string }) {
  return <SignIn {...props} routing="path" signUpUrl={signUpUrl} appearance={useAppearance()} />;
}

export function ThemedSignUp({ signInUrl, ...props }: AuthCardProps & { signInUrl: string }) {
  return <SignUp {...props} routing="path" signInUrl={signInUrl} appearance={useAppearance()} />;
}

export function ThemedUserProfile({ path }: { path: string }) {
  return <UserProfile path={path} routing="path" appearance={useAppearance()} />;
}

export function ThemedUserButton() {
  return <UserButton appearance={useAppearance()} />;
}

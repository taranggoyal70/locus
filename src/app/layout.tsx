import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Locus — the token-efficient coding agent",
  description:
    "Give Locus an engineering task. It finds the smallest safe context, implements the change in an isolated sandbox, and verifies the result.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://locus-five-iota.vercel.app"),
  openGraph: {
    title: "Locus — the token-efficient coding agent",
    description: "Ship the task, not the repository. Focus context, implement, and verify.",
    siteName: "Locus",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Locus — the token-efficient coding agent",
    description: "Ship the task, not the repository. Focus context, implement, and verify.",
  },
  keywords: [
    "AI coding agent", "context window", "code context", "MCP server",
    "dependency graph", "TypeScript", "developer tools", "Claude", "Cursor", "Codex",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignOutUrl="/"
      localization={{
        signIn: { start: { title: "Sign in to Locus" } },
        signUp: { start: { title: "Create your Locus account" } },
      }}
    >
      <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} h-full antialiased`}>
        <body className="min-h-full">{children}</body>
      </html>
    </ClerkProvider>
  );
}

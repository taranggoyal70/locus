import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Locus — task-sized context for coding agents",
  description:
    "Map a coding task to the exact files your AI agent needs. Deterministic dependency tracing with conservative whole-repo fallback.",
  metadataBase: new URL("https://locus-five-iota.vercel.app"),
  openGraph: {
    title: "Locus — task-sized context for coding agents",
    description: "Give your agent a task-sized view of the codebase instead of dumping everything.",
    siteName: "Locus",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Locus — task-sized context for coding agents",
    description: "Give your agent a task-sized view of the codebase instead of dumping everything.",
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
      <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
        <body className="min-h-full">{children}</body>
      </html>
    </ClerkProvider>
  );
}

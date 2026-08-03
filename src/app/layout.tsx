import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Locus — evidence-first coding agent alpha",
  description:
    "Localize a public Repo, run a task in an isolated Sandbox, and review a check-passing proposal with every Included, Excluded, and Widened file visible.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://locus-five-iota.vercel.app"),
  openGraph: {
    title: "Locus — evidence-first coding agent alpha",
    description: "Ship the task, not the repository. Focus context, implement, check, and review.",
    siteName: "Locus",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Locus — evidence-first coding agent alpha",
    description: "Ship the task, not the repository. Focus context, implement, check, and review.",
  },
  keywords: [
    "AI coding agent", "context window", "code context", "public repository",
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

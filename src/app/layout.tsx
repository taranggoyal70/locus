import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import { connection } from "next/server";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Locus — evidence-first code localization",
  description:
    "Localize a public JavaScript or TypeScript Repo into a task-sized Slice with every Included, Excluded, and Widened file visible.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://locus-five-iota.vercel.app"),
  openGraph: {
    title: "Locus — evidence-first code localization",
    description: "Ship the task, not the repository. Build a task-sized Slice with visible context evidence.",
    siteName: "Locus",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Locus — evidence-first code localization",
    description: "Ship the task, not the repository. Build a task-sized Slice with visible context evidence.",
  },
  keywords: [
    "AI coding agent", "context window", "code context", "public repository",
    "dependency graph", "TypeScript", "developer tools", "Claude", "Cursor", "Codex",
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Clerk's strict CSP creates a nonce per request. Rendering against the
  // incoming request lets Next apply that nonce to its framework, Analytics,
  // and Speed Insights scripts instead of serving nonce-less static HTML.
  await connection();

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

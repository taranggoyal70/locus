import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { headers } from "next/headers";
import { connection } from "next/server";

import { THEME_BOOT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// The display serif. Its optical-size axis gives large headlines the fine
// display cut and small headings the sturdier text cut from one file.
const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"], axes: ["opsz"] });

export const metadata: Metadata = {
  title: "Locus · Evidence-first code localization",
  description:
    "Localize a public JavaScript, TypeScript, or Python Repo into a task-sized Slice with every Included, Excluded, and Widened file visible.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://locus-five-iota.vercel.app"),
  openGraph: {
    title: "Locus · Evidence-first code localization",
    description: "Ship the task, not the repository. Build a task-sized Slice with visible context evidence.",
    siteName: "Locus",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Locus · Evidence-first code localization",
    description: "Ship the task, not the repository. Build a task-sized Slice with visible context evidence.",
  },
  keywords: [
    "AI coding agent", "context window", "code context", "public repository",
    "dependency graph", "TypeScript", "developer tools", "Claude", "Cursor", "Codex",
  ],
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f1ea" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1420" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Clerk's strict CSP creates a nonce per request. Rendering against the
  // incoming request lets Next apply that nonce to its framework, Analytics,
  // and Speed Insights scripts instead of serving nonce-less static HTML.
  await connection();
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="en"
      // The theme boot script sets data-theme before React hydrates.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full antialiased`}
    >
      <head>
        {/* Runs before first paint so a pinned theme never flashes the other one. */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

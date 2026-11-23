"use client";

import Link from "next/link";

import { ThemedUserButton } from "@/components/ClerkThemed";
import { frame, Rails } from "@/components/Datasheet";
import { MarketingNavLink } from "@/components/MarketingNavLink";
import { NavShortcuts } from "@/components/NavShortcuts";
import { ScrollThread } from "@/components/ScrollThread";
import { Wordmark } from "@/components/Wordmark";

/** Signed-in navigation. Each number is a real shortcut, printed on its keycap. */
const NAV = [
  { href: "/workspace", label: "Workspace", shortcut: "1" },
  { href: "/projects", label: "Runs", shortcut: "2" },
  { href: "/settings", label: "Settings", shortcut: "3" },
] as const;

const FOOTER_LINKS = [
  { href: "/docs", label: "Docs" },
  { href: "/support", label: "Support" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
] as const;

const monoLabel = "font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted";

/**
 * The frame of every signed-in page: the public site's header, margin rails and
 * print grammar, with the product's own navigation. Pages put their sections
 * inside `frame` and separate them with a `Rule`, as the public pages do.
 *
 * On phones the keycaps go (the shortcuts are for keyboards) and, below 420px,
 * the wordmark's name, so the three links and the account button stay on one
 * line down to 320px.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip text-ink">
      <NavShortcuts />
      <header className="sticky top-0 z-40 border-b border-line bg-canvas">
        <div className={`${frame} flex h-[60px] items-center justify-between gap-3`}>
          <Link href="/workspace" aria-label="Locus workspace" className="shrink-0 text-ink">
            <Wordmark nameClassName="max-[420px]:hidden" />
          </Link>
          <nav className="flex min-w-0 items-center gap-0.5" aria-label="App navigation">
            {NAV.map((item) => (
              <MarketingNavLink
                key={item.href}
                href={item.href}
                shortcut={item.shortcut}
                // Without its keycap on phones, the current page is underlined in ink instead.
                className="px-2 max-[360px]:px-1.5 max-[360px]:text-[13px] sm:px-2.5 max-md:aria-[current=page]:underline max-md:aria-[current=page]:decoration-ink max-md:aria-[current=page]:underline-offset-[6px]"
                keycapClassName="max-md:hidden"
              >
                {item.label}
              </MarketingNavLink>
            ))}
            <Link
              href="/docs"
              className="hidden h-9 items-center rounded-chip px-2.5 text-[14px] text-ink-2 transition-colors duration-150 hover:text-ink lg:inline-flex"
            >
              Docs
            </Link>
            <span className="ml-2 flex h-9 items-center border-l border-line pl-3 max-[360px]:pl-2">
              <ThemedUserButton />
            </span>
          </nav>
        </div>
        <ScrollThread />
      </header>
      <div className="relative flex-1">
        <Rails />
        {children}
      </div>
      <footer className="border-t border-line">
        <div className={`${frame} flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-6`}>
          <p className={monoLabel}>Locus · Public early access</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            {FOOTER_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="inline-block py-1 text-[13px] text-ink-2 transition-colors duration-150 hover:text-ink">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </footer>
    </div>
  );
}

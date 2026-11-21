import Link from "next/link";

import { admissionSentence } from "@/lib/admission-copy";
import { REPO_URL } from "@/lib/config";
import { CommandPalette } from "@/components/CommandPalette";
import { frame, Rails } from "@/components/Datasheet";
import { FooterField } from "@/components/FooterField";
import { MarketingNavLink } from "@/components/MarketingNavLink";
import { MobileMenu } from "@/components/MobileMenu";
import { NavShortcuts } from "@/components/NavShortcuts";
import { ScrollThread } from "@/components/ScrollThread";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { Wordmark } from "@/components/Wordmark";

/** Header navigation. Each number is a real shortcut, printed on its keycap. */
const NAV = [
  { href: "/demo", label: "Demo", shortcut: "1" },
  { href: "/evidence/release-1", label: "Evidence", shortcut: "2" },
  { href: "/docs", label: "Docs", shortcut: "3" },
  { href: "/pricing", label: "Agent access", shortcut: "4" },
] as const;

const FOOTER_COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/workspace", label: "Workspace" },
      { href: "/demo", label: "Demo" },
      { href: "/pricing", label: "Agent access" },
    ],
  },
  {
    title: "Developers",
    links: [
      { href: "/docs", label: "API" },
      { href: "/evidence/release-1", label: "Evidence" },
      { href: REPO_URL, label: "GitHub ↗", external: true },
    ],
  },
  {
    title: "Trust",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/support", label: "Support" },
    ],
  },
] as const;

const label = "font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted";

/**
 * `selfServeOpen` is a required prop rather than an environment read.
 *
 * This shell is rendered from both server pages and a client one. A component
 * that reads LOCUS_SELF_SERVE itself works in the first case and silently reads
 * undefined in the second, rendering "invite-gated" on an open deployment with
 * no error anywhere. Taking it as a prop makes the caller's environment the
 * caller's problem, and the compiler enforces that every caller has an answer.
 */
export function MarketingShell({
  children,
  selfServeOpen: open,
}: {
  children: React.ReactNode;
  selfServeOpen: boolean;
}) {
  return (
    <div className="min-h-screen overflow-x-clip">
      <NavShortcuts />
      <header className="sticky top-0 z-40 border-b border-line bg-canvas">
        <div className={`${frame} flex h-[60px] items-center justify-between gap-4`}>
          <Link href="/" aria-label="Locus home" className="text-ink">
            <Wordmark />
          </Link>
          <nav className="flex items-center gap-1" aria-label="Main navigation">
            <div className="hidden items-center gap-0.5 lg:flex">
              {NAV.map((item) => (
                <MarketingNavLink key={item.href} href={item.href} shortcut={item.shortcut}>
                  {item.label}
                </MarketingNavLink>
              ))}
              <a href={REPO_URL} className="inline-flex h-9 items-center rounded-chip px-2.5 text-[14px] text-ink-2 transition-colors duration-150 hover:text-ink">
                Source
              </a>
            </div>
            <CommandPalette />
            <Link href="/sign-in" className="inline-flex h-9 items-center rounded-chip px-2.5 text-[14px] text-ink-2 transition-colors duration-150 hover:text-ink">Sign in</Link>
            <Link
              href="/workspace"
              className="ml-1 inline-flex h-9 items-center gap-2 rounded-chip bg-ink px-3.5 text-[14px] font-medium text-canvas transition-[background-color,transform] duration-150 hover:bg-ink/88 active:scale-[0.97]"
            >
              Try Locus <span aria-hidden="true">↗</span>
            </Link>
            <MobileMenu items={NAV} />
          </nav>
        </div>
        <ScrollThread />
      </header>
      <div className="relative">
        <Rails />
        {children}
      </div>
      <footer data-band="dark" className="bg-canvas text-ink">
        <div className={frame}>
          <FooterField className="pt-14" />
          <div className="grid grid-cols-3 gap-x-6 gap-y-10 border-t border-line py-12 md:grid-cols-[1.4fr_repeat(3,minmax(0,1fr))]">
            <div className="col-span-3 md:col-span-1">
              <Wordmark size={26} />
              <p className="mt-4 max-w-xs text-[14px] leading-6 text-ink-2">{admissionSentence(open)}</p>
            </div>
            {FOOTER_COLUMNS.map((column) => (
              <div key={column.title}>
                <p className={label}>{column.title}</p>
                <ul className="mt-4 space-y-1">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      {"external" in link ? (
                        <a href={link.href} className="inline-block py-1 text-[15px] text-ink-2 transition-colors duration-150 hover:text-ink">{link.label}</a>
                      ) : (
                        <Link href={link.href} className="inline-block py-1 text-[15px] text-ink-2 transition-colors duration-150 hover:text-ink">{link.label}</Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line py-6">
            <p className={label}>Locus · Public early access</p>
            <ThemeSwitch />
          </div>
        </div>
      </footer>
    </div>
  );
}

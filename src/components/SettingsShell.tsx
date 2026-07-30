"use client";

import { UserButton } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/workspace", label: "Workspace", shortLabel: "Work" },
  { href: "/projects", label: "Saved tasks", shortLabel: "Saved" },
  { href: "/settings", label: "Settings", shortLabel: "Settings" },
];

export function SettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-ink/[0.88] backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-3.5 sm:px-8">
          <Link href="/workspace" className="flex items-center gap-3 text-paper">
            <Image src="/locus-mark.svg" width={28} height={28} alt="" priority />
            <span className="hidden font-semibold tracking-[-0.02em] sm:inline">Locus</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm sm:gap-3" aria-label="Account navigation">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? "page" : undefined}
                className={`rounded-lg px-2 py-2 transition sm:px-3 ${
                  pathname === item.href
                    ? "text-accent font-medium"
                    : "text-muted-light hover:text-paper"
                }`}
              >
                <span className="sm:hidden">{item.shortLabel}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            ))}
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "h-9 w-9 border border-line-strong",
                  userButtonPopoverCard: "border border-line-strong bg-surface text-paper shadow-2xl",
                },
              }}
            />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
        {children}
      </main>
    </div>
  );
}

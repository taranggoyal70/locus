"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemedUserButton } from "@/components/ClerkThemed";
import { Wordmark } from "@/components/Wordmark";

const NAV_ITEMS = [
  { href: "/workspace", label: "Workspace" },
  { href: "/projects", label: "Runs" },
  { href: "/settings", label: "Settings" },
];

export function SettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas">
        <div className="mx-auto flex h-[60px] max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <Link href="/workspace" aria-label="Locus workspace" className="text-ink">
            <Wordmark />
          </Link>
          <nav className="flex items-center gap-0.5 text-[14px] sm:gap-1" aria-label="App navigation">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href || (item.href === "/settings" && pathname.startsWith("/settings/"));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex h-9 items-center rounded-chip px-2.5 transition-colors duration-150 ${
                    active ? "bg-surface-2 font-medium text-ink" : "text-ink-2 hover:text-ink"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <span className="ml-2">
              <ThemedUserButton />
            </span>
          </nav>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        {children}
      </main>
    </div>
  );
}

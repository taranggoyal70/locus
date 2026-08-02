"use client";

import { UserButton } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/workspace", label: "Workspace" },
  { href: "/projects", label: "Runs" },
  { href: "/settings", label: "Settings" },
];

export function SettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="site-noise min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/[0.86] backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-8">
          <Link href="/workspace" className="flex items-center gap-3 text-paper">
            <Image src="/locus-mark.svg" width={28} height={28} alt="" priority />
            <span className="font-display font-semibold tracking-[-0.03em]">Locus</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm sm:gap-2">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-3 py-2 transition ${
                  pathname === item.href
                    ? "bg-paper text-ink font-medium"
                    : "text-muted-light hover:text-paper"
                }`}
              >
                {item.label}
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

      <main className="relative mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        {children}
      </main>
    </div>
  );
}

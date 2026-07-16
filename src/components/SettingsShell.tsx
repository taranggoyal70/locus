"use client";

import { UserButton } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";

export function SettingsShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-ink/[0.88] backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-3.5 sm:px-8">
          <Link href="/workspace" className="flex items-center gap-3 text-paper">
            <Image src="/locus-mark.svg" width={28} height={28} alt="" priority />
            <span className="font-semibold tracking-[-0.02em]">Locus</span>
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/workspace" className="rounded-lg px-3 py-2 text-muted-light transition hover:text-paper">
              Workspace
            </Link>
            <Link href="/projects" className="rounded-lg px-3 py-2 text-muted-light transition hover:text-paper">
              Projects
            </Link>
            <Link href="/settings" className="rounded-lg px-3 py-2 text-accent font-medium">
              Settings
            </Link>
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

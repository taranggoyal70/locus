import Image from "next/image";
import Link from "next/link";

import { REPO_URL } from "@/lib/config";

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="site-noise min-h-screen overflow-x-clip">
      <header className="sticky top-0 z-40 border-b border-line-strong bg-ink/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 sm:px-8">
          <Link href="/" className="flex items-center gap-3 text-paper">
            <Image src="/locus-mark.svg" width={30} height={30} alt="" priority />
            <span className="hidden font-display text-[17px] font-semibold tracking-[-0.03em] sm:inline">Locus</span>
          </Link>
          <nav className="flex items-center gap-1 text-xs font-medium sm:gap-2 sm:text-sm" aria-label="Main navigation">
            <Link href="/docs" className="hidden rounded-lg px-2.5 py-2 text-muted-light transition hover:bg-surface hover:text-paper sm:block sm:px-3">Docs</Link>
            <Link href="/pricing" className="hidden rounded-lg px-2.5 py-2 text-muted-light transition hover:bg-surface hover:text-paper md:block md:px-3">Alpha access</Link>
            <a href={REPO_URL} className="hidden rounded-lg px-3 py-2 text-muted-light transition hover:bg-surface hover:text-paper sm:block">Source</a>
            <Link href="/sign-in" className="hidden rounded-lg px-3 py-2 text-muted-light transition hover:bg-surface hover:text-paper md:block">Sign in</Link>
            <Link href="/pricing" className="ml-1 rounded-lg bg-paper px-3 py-2 text-white transition hover:bg-paper/90 sm:px-4">Request access</Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className="border-t border-line-strong bg-surface/65">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 text-sm sm:grid-cols-[1fr_auto] sm:px-8">
          <div>
            <div className="flex items-center gap-2.5">
              <Image src="/locus-mark.svg" width={24} height={24} alt="" />
              <span className="font-display font-semibold text-paper">Locus</span>
            </div>
            <p className="mt-3 max-w-md text-xs leading-5 text-muted-light">Public-Repo proposals with visible context evidence. Free for invited design partners.</p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-light sm:justify-end">
            <Link href="/docs" className="hover:text-paper">API</Link>
            <Link href="/pricing" className="hover:text-paper">Alpha access</Link>
            <Link href="/privacy" className="hover:text-paper">Privacy</Link>
            <Link href="/terms" className="hover:text-paper">Terms</Link>
            <a href={REPO_URL} className="hover:text-paper">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

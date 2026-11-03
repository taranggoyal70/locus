import Image from "next/image";
import Link from "next/link";

import { admissionSentence } from "@/lib/admission-copy";
import { REPO_URL } from "@/lib/config";

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
      <header className="sticky top-0 z-40 border-b border-line-strong bg-canvas/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 sm:px-8">
          <Link href="/" aria-label="Locus home" className="flex items-center gap-3 text-ink">
            <Image src="/locus-mark.svg" width={30} height={30} alt="" priority />
            <span className="hidden font-display text-[17px] font-semibold tracking-[-0.03em] sm:inline">Locus</span>
          </Link>
          <nav className="flex items-center gap-1 text-xs font-medium sm:gap-2 sm:text-sm" aria-label="Main navigation">
            <Link href="/demo" className="rounded-lg px-2.5 py-2 text-muted-light transition hover:bg-surface hover:text-ink sm:px-3">Demo</Link>
            <Link href="/evidence/release-1" className="hidden rounded-lg px-2.5 py-2 text-muted-light transition hover:bg-surface hover:text-ink sm:block sm:px-3">Evidence</Link>
            <Link href="/docs" className="hidden rounded-lg px-2.5 py-2 text-muted-light transition hover:bg-surface hover:text-ink sm:block sm:px-3">Docs</Link>
            <Link href="/pricing" className="hidden rounded-lg px-2.5 py-2 text-muted-light transition hover:bg-surface hover:text-ink md:block md:px-3">Agent access</Link>
            <a href={REPO_URL} className="hidden rounded-lg px-3 py-2 text-muted-light transition hover:bg-surface hover:text-ink sm:block">Source</a>
            <Link href="/sign-in" className="rounded-lg px-2.5 py-2 text-muted-light transition hover:bg-surface hover:text-ink sm:px-3">Sign in</Link>
            <Link href="/workspace" className="ml-1 rounded-lg bg-ink px-3 py-2 text-white transition hover:bg-ink/90 sm:px-4">Try Locus</Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className="border-t border-line-strong bg-surface/65">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 text-sm sm:grid-cols-[1fr_auto] sm:px-8">
          <div>
            <div className="flex items-center gap-2.5">
              <Image src="/locus-mark.svg" width={24} height={24} alt="" />
              <span className="font-display font-semibold text-ink">Locus</span>
            </div>
            <p className="mt-3 max-w-md text-xs leading-5 text-muted-light">{admissionSentence(open)}</p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-light sm:justify-end">
            <Link href="/demo" className="hover:text-ink">Demo</Link>
            <Link href="/docs" className="hover:text-ink">API</Link>
            <Link href="/evidence/release-1" className="hover:text-ink">Evidence</Link>
            <Link href="/pricing" className="hover:text-ink">Agent access</Link>
            <Link href="/privacy" className="hover:text-ink">Privacy</Link>
            <Link href="/terms" className="hover:text-ink">Terms</Link>
            <Link href="/support" className="hover:text-ink">Support</Link>
            <a href={REPO_URL} className="hover:text-ink">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

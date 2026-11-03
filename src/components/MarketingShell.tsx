import Image from "next/image";
import Link from "next/link";

import { admissionSentence } from "@/lib/admission-copy";
import { REPO_URL } from "@/lib/config";

const navLink =
  "rounded-chip px-2.5 py-2 text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink sm:px-3";

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
      <header className="sticky top-0 z-40 border-b border-line bg-canvas">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 sm:px-8">
          <Link href="/" aria-label="Locus home" className="flex items-center gap-2.5 text-ink">
            <Image src="/locus-mark.svg" width={28} height={28} alt="" priority />
            <span className="hidden text-[17px] font-semibold tracking-[-0.02em] sm:inline">Locus</span>
          </Link>
          <nav className="flex items-center gap-0.5 text-[13px] font-medium sm:gap-1 sm:text-sm" aria-label="Main navigation">
            <Link href="/demo" className={navLink}>Demo</Link>
            <Link href="/evidence/release-1" className={`${navLink} hidden sm:block`}>Evidence</Link>
            <Link href="/docs" className={`${navLink} hidden sm:block`}>Docs</Link>
            <Link href="/pricing" className={`${navLink} hidden md:block`}>Agent access</Link>
            <a href={REPO_URL} className={`${navLink} hidden sm:block`}>Source</a>
            <Link href="/sign-in" className={navLink}>Sign in</Link>
            <Link
              href="/workspace"
              className="ml-1.5 rounded-card bg-ink px-3 py-2 font-semibold text-canvas transition-[background-color,transform] duration-150 hover:bg-ink/90 active:scale-[0.97] sm:px-4"
            >
              Try Locus
            </Link>
          </nav>
        </div>
      </header>
      {children}
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 text-sm sm:grid-cols-[1fr_auto] sm:px-8">
          <div>
            <div className="flex items-center gap-2.5">
              <Image src="/locus-mark.svg" width={24} height={24} alt="" />
              <span className="font-semibold tracking-[-0.02em] text-ink">Locus</span>
            </div>
            <p className="mt-3 max-w-md text-[13px] leading-5 text-muted">{admissionSentence(open)}</p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-ink-2 sm:justify-end">
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

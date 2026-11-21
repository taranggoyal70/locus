import Link from "next/link";
import type { ReactNode } from "react";

import { MiniField } from "@/components/MiniField";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { Wordmark } from "@/components/Wordmark";

type AuthShellProps = {
  children: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
};

const BOUNDARIES = [
  ["Slice", "Visible"],
  ["Excluded", "Visible"],
  ["External writes", "Disabled"],
] as const;

const monoLabel = "font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted";

export function AuthShell({ children, eyebrow, title, description }: AuthShellProps) {
  return (
    <main className="relative min-h-screen overflow-x-hidden">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-5 sm:px-8">
        <header className="flex h-[60px] items-center justify-between border-b border-line">
          <Link href="/" aria-label="Locus home" className="flex items-center gap-2.5 text-ink">
            <Wordmark />
          </Link>
          <Link href="/" className="text-[14px] text-ink-2 transition-colors hover:text-ink">
            <span aria-hidden="true">←</span> Back to site
          </Link>
        </header>

        <div className="grid min-w-0 flex-1 grid-cols-1 items-center gap-12 py-12 sm:py-16 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-20">
          <section className="min-w-0 max-w-xl">
            <p className={monoLabel}>{eyebrow}</p>
            <h1 className="mt-5 font-display text-[clamp(2.6rem,5vw,4.4rem)] font-normal leading-[1.0] tracking-[-0.02em] text-ink">
              {title}
            </h1>
            <p className="mt-6 max-w-lg text-[17px] leading-[1.65] text-ink-2">{description}</p>

            <div className="mt-12 hidden sm:block">
              <dl className="grid grid-cols-3 border-t border-ink">
                {BOUNDARIES.map(([name, value], index) => (
                  <div key={name} className={`py-4 ${index > 0 ? "border-l border-line pl-4" : ""}`}>
                    <dt className={monoLabel}>{name}</dt>
                    <dd className="mt-1.5 text-[15px] font-medium text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-8">
                <MiniField columns={16} rows={3} slice={[5, 6, 21, 22, 23, 38]} />
              </div>
            </div>
          </section>

          <section className="flex w-full min-w-0 justify-center lg:justify-end">{children}</section>
        </div>

        <footer className="flex flex-col gap-3 border-t border-line py-5 sm:flex-row sm:items-center sm:justify-between">
          <span className={monoLabel}>Public early access · Public Repos · Secure authentication by Clerk</span>
          <ThemeSwitch />
        </footer>
      </div>
    </main>
  );
}

/**
 * Holds Clerk's place while its script loads. It is about as tall as the
 * production card (Google, email and password: 541 to 549px), so the card
 * replaces it without moving the page.
 */
export function AuthLoading({ label }: { label: string }) {
  return (
    <div
      className="flex min-h-[545px] w-full items-center justify-center rounded-card border border-ink bg-surface px-8 text-center"
      role="status"
      aria-live="polite"
    >
      <div>
        <div className="mx-auto w-fit">
          <MiniField columns={5} rows={3} slice={[6, 7, 8]} />
        </div>
        <p className="mt-6 text-[15px] font-medium text-ink">{label}</p>
        <p className="mt-1.5 text-[13px] text-muted">Connecting securely…</p>
      </div>
    </div>
  );
}

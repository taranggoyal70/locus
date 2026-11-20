"use client";

import Link from "next/link";

import { Wordmark } from "@/components/Wordmark";
import { MiniField } from "@/components/MiniField";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col px-5 sm:px-8">
      <header className="flex h-[60px] items-center border-b border-line">
        <Link href="/" aria-label="Locus home" className="text-ink">
          <Wordmark />
        </Link>
      </header>
      <div className="grid flex-1 content-center gap-12 py-16 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div>
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-failed">Run interrupted</p>
          <h1 className="mt-5 font-display text-[clamp(40px,6vw,80px)] font-normal leading-[0.98] tracking-[-0.02em] text-ink">
            Something went wrong.
          </h1>
          <p className="mt-6 max-w-md text-[17px] leading-[1.65] text-ink-2">{error.message || "An unexpected error occurred."}</p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-11 items-center rounded-chip bg-ink px-5 text-[15px] font-medium text-canvas transition-[background-color,transform] duration-150 hover:bg-ink/88 active:scale-[0.97]"
            >
              Try again
            </button>
            <Link
              href="/"
              className="inline-flex h-11 items-center rounded-chip border border-line-2 px-5 text-[15px] font-medium text-ink transition-colors duration-150 hover:border-ink"
            >
              Go home
            </Link>
          </div>
        </div>
        <MiniField columns={9} rows={6} slice={[19, 20, 21, 28]} hole={29} tone="danger" />
      </div>
    </main>
  );
}

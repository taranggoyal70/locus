"use client";

import Image from "next/image";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 text-center">
      <Image src="/locus-mark.svg" width={48} height={48} alt="" className="opacity-40" />
      <p className="mt-6 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-recent">Run interrupted</p>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.04em] text-paper">Something went wrong</h1>
      <p className="mt-2 max-w-md text-sm text-muted-light">{error.message || "An unexpected error occurred."}</p>
      <div className="mt-8 flex gap-3">
        <button
          onClick={reset}
          className="rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-ink transition hover:bg-accent-dim"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-xl border border-line-strong px-5 py-3 text-sm font-medium text-paper transition hover:border-accent/40"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}

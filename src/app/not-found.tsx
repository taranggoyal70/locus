import Link from "next/link";

import { Wordmark } from "@/components/Wordmark";
import { MiniField } from "@/components/MiniField";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col px-5 sm:px-8">
      <header className="flex h-[60px] items-center border-b border-line">
        <Link href="/" aria-label="Locus home" className="text-ink">
          <Wordmark />
        </Link>
      </header>
      <div className="grid flex-1 content-center gap-12 py-16 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div>
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted">404 · Outside the Slice</p>
          <h1 className="mt-5 font-display text-[clamp(44px,7vw,96px)] font-normal leading-[0.98] tracking-[-0.02em] text-ink">
            This path was
            <span className="block text-muted">excluded from the map.</span>
          </h1>
          <p className="mt-6 max-w-md text-[17px] leading-[1.65] text-ink-2">
            Nothing lives at this address. The pages that do are one hop away.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Link
              href="/"
              className="inline-flex h-11 items-center gap-2 rounded-chip bg-ink px-5 text-[15px] font-medium text-canvas transition-[background-color,transform] duration-150 hover:bg-ink/88 active:scale-[0.97]"
            >
              Back to Locus
            </Link>
            <Link href="/docs" className="text-[14px] font-medium text-ink underline decoration-line-2 underline-offset-[5px] transition-colors hover:decoration-ink">
              Read the docs
            </Link>
          </div>
        </div>
        <MiniField columns={9} rows={6} slice={[10, 11, 19, 20, 28]} hole={40} />
      </div>
    </main>
  );
}

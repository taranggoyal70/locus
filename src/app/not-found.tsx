import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 text-center">
      <Image src="/locus-mark.svg" width={48} height={48} alt="" className="opacity-40" />
      <p className="mt-6 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-accent">Outside the slice</p>
      <h1 className="mt-2 font-display text-5xl font-semibold tracking-[-0.05em] text-paper">404</h1>
      <p className="mt-2 text-sm text-muted-light">This path was excluded from the current map.</p>
      <Link
        href="/"
        className="mt-8 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-ink transition hover:bg-accent-dim"
      >
        Back to Locus
      </Link>
    </div>
  );
}

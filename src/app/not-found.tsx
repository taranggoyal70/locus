import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 text-center">
      <Image src="/locus-mark.svg" width={48} height={48} alt="" className="opacity-40" />
      <h1 className="mt-6 text-4xl font-semibold tracking-tight text-paper">404</h1>
      <p className="mt-2 text-sm text-muted-light">This page doesn&apos;t exist in the slice.</p>
      <Link
        href="/"
        className="mt-8 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-ink transition hover:bg-[#b5f34a]"
      >
        Back to Locus
      </Link>
    </div>
  );
}

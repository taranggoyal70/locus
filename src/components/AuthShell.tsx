import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

type AuthShellProps = {
  children: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
};

export function AuthShell({ children, eyebrow, title, description }: AuthShellProps) {
  return (
    <main className="relative min-h-screen overflow-hidden px-5 py-8 sm:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_25%,rgba(163,230,53,0.08),transparent_34%)]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col">
        <header className="flex items-center">
          <Link href="/" className="flex items-center gap-3 text-paper">
            <Image src="/locus-mark.svg" width={28} height={28} alt="" priority />
            <span className="font-semibold tracking-[-0.02em]">Locus</span>
          </Link>
        </header>

        <div className="grid flex-1 items-center gap-12 py-14 lg:grid-cols-[minmax(0,1fr)_440px]">
          <section className="max-w-xl">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-accent">{eyebrow}</p>
            <h1 className="mt-5 text-5xl font-semibold leading-[0.98] tracking-[-0.055em] text-paper sm:text-6xl">{title}</h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-muted-light sm:text-lg">{description}</p>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {[
                ["01", "Load a repository"],
                ["02", "Describe the task"],
                ["03", "Copy focused context"],
              ].map(([step, label]) => (
                <div key={step} className="rounded-xl border border-line-strong bg-surface/70 p-4">
                  <span className="font-mono text-[10px] text-accent">{step}</span>
                  <p className="mt-3 text-sm leading-5 text-paper">{label}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="flex justify-center lg:justify-end">{children}</section>
        </div>

        <footer className="flex items-center justify-between border-t border-line py-5 text-xs text-muted">
          <span>Open-source beta</span>
          <span>Secure authentication by Clerk</span>
        </footer>
      </div>
    </main>
  );
}

export function AuthLoading({ label }: { label: string }) {
  return (
    <div className="flex min-h-80 w-full items-center justify-center rounded-[20px] border border-line-strong bg-surface px-8 text-center shadow-[0_40px_120px_rgba(0,0,0,0.32)]" role="status" aria-live="polite">
      <div>
        <Image src="/locus-mark.svg" width={32} height={32} alt="" className="mx-auto" />
        <p className="mt-5 text-sm font-medium text-paper">{label}</p>
        <p className="mt-2 text-xs text-muted">Connecting securely…</p>
      </div>
    </div>
  );
}

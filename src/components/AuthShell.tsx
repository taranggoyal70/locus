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
    <main className="relative min-h-screen overflow-x-hidden px-5 py-6 sm:px-8 sm:py-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_25%,rgba(163,230,53,0.08),transparent_34%)]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col">
        <header className="flex items-center">
          <Link href="/" className="flex items-center gap-3 text-paper">
            <Image src="/locus-mark.svg" width={28} height={28} alt="" priority />
            <span className="font-semibold tracking-[-0.02em]">Locus</span>
          </Link>
        </header>

        <div className="grid min-w-0 flex-1 grid-cols-1 items-center gap-8 py-10 sm:gap-12 sm:py-14 lg:grid-cols-[minmax(0,1fr)_440px]">
          <section className="min-w-0 max-w-xl">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-accent">{eyebrow}</p>
            <h1 className="mt-4 text-4xl font-semibold leading-[1.02] tracking-[-0.05em] text-paper sm:mt-5 sm:text-6xl sm:leading-[0.98]">{title}</h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-muted-light sm:mt-6 sm:text-lg">{description}</p>

            <div className="mt-10 hidden gap-3 sm:grid sm:grid-cols-3">
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

          <section className="flex min-w-0 w-full justify-center lg:justify-end">{children}</section>
        </div>

        <footer className="flex flex-col gap-2 border-t border-line py-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
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

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

type AuthShellProps = {
  children: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
};

export const AUTH_APPEARANCE = {
  variables: {
    colorPrimary: "#087864",
    colorBackground: "#f9fbf7",
    colorInputBackground: "#edf1ee",
    colorInputText: "#14233b",
    colorText: "#14233b",
    colorTextSecondary: "#4e605d",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "w-full shadow-none",
    card: "w-full border border-line-strong bg-surface shadow-[0_30px_80px_rgba(20,35,59,0.12)]",
    headerTitle: "text-paper",
    headerSubtitle: "text-muted-light",
    socialButtonsBlockButton: "border-line-strong bg-ink text-paper hover:bg-surface-raised",
    formFieldInput: "border-line-strong bg-ink text-paper",
    formButtonPrimary: "bg-paper text-white hover:bg-paper/90",
    footerActionLink: "text-accent hover:text-accent-dim",
    dividerLine: "bg-line-strong",
    dividerText: "text-muted",
  },
} as const;

export function AuthShell({ children, eyebrow, title, description }: AuthShellProps) {
  return (
    <main className="site-noise relative min-h-screen overflow-x-hidden px-5 py-6 sm:px-8 sm:py-8">
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
            <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.02] tracking-[-0.055em] text-paper sm:mt-5 sm:text-6xl sm:leading-[0.94]">{title}</h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-muted-light sm:mt-6 sm:text-lg">{description}</p>

            <div className="mt-10 hidden overflow-hidden rounded-2xl border border-line-strong bg-surface/70 sm:block">
              <div className="grid grid-cols-3 gap-px bg-line-strong">
                {[["Slice", "Visible"], ["Excluded", "Visible"], ["External writes", "Disabled"]].map(([label, value]) => (
                  <div key={label} className="bg-surface px-4 py-3">
                    <span className="font-mono text-[9px] uppercase text-muted">{label}</span>
                    <p className="mt-1 text-sm font-semibold text-paper">{value}</p>
                  </div>
                ))}
              </div>
              <div className="aperture-rule h-2 border-t border-line-strong" />
            </div>
          </section>

          <section className="flex min-w-0 w-full justify-center lg:justify-end">{children}</section>
        </div>

        <footer className="flex flex-col gap-2 border-t border-line-strong py-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>Invite-only controlled alpha</span>
          <span>Public Repos · Secure authentication by Clerk</span>
        </footer>
      </div>
    </main>
  );
}

export function AuthLoading({ label }: { label: string }) {
  return (
    <div className="flex min-h-80 w-full items-center justify-center rounded-[20px] border border-line-strong bg-surface px-8 text-center shadow-[0_30px_80px_rgba(20,35,59,0.12)]" role="status" aria-live="polite">
      <div>
        <Image src="/locus-mark.svg" width={32} height={32} alt="" className="mx-auto" />
        <p className="mt-5 text-sm font-medium text-paper">{label}</p>
        <p className="mt-2 text-xs text-muted">Connecting securely…</p>
      </div>
    </div>
  );
}

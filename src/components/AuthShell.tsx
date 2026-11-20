import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

type AuthShellProps = {
  children: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
};

// Clerk takes literal colours, not CSS variables, so these mirror the tokens in
// globals.css: --ink for the primary action, --surface, --canvas, --ink-2.
export const AUTH_APPEARANCE = {
  variables: {
    colorPrimary: "#14233b",
    colorBackground: "#fbfaf7",
    colorInputBackground: "#f4f3ef",
    colorInputText: "#14233b",
    colorText: "#14233b",
    colorTextSecondary: "#3e4f63",
    borderRadius: "0.625rem",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "w-full shadow-none",
    card: "w-full border border-line-2 bg-surface shadow-panel",
    headerTitle: "text-ink",
    headerSubtitle: "text-ink-2",
    socialButtonsBlockButton: "border-line-2 bg-canvas text-ink hover:bg-surface-2",
    formFieldInput: "border-line-2 bg-canvas text-ink",
    formButtonPrimary: "bg-ink text-white hover:bg-ink/90",
    footerActionLink: "text-ink underline decoration-line-2 underline-offset-2 hover:decoration-ink",
    dividerLine: "bg-line-2",
    dividerText: "text-muted",
  },
} as const;

export function AuthShell({ children, eyebrow, title, description }: AuthShellProps) {
  return (
    <main className="relative min-h-screen overflow-x-hidden px-5 py-6 sm:px-8 sm:py-8">
      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col">
        <header className="flex items-center">
          <Link href="/" className="flex items-center gap-3 text-ink">
            <Image src="/locus-mark.svg" width={28} height={28} alt="" priority />
            <span className="font-semibold tracking-[-0.02em]">Locus</span>
          </Link>
        </header>

        <div className="grid min-w-0 flex-1 grid-cols-1 items-center gap-8 py-10 sm:gap-12 sm:py-14 lg:grid-cols-[minmax(0,1fr)_440px]">
          <section className="min-w-0 max-w-xl">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-muted">{eyebrow}</p>
            <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.02] tracking-[-0.04em] text-ink sm:mt-5 sm:text-6xl sm:leading-[0.94]">{title}</h1>
            <p className="mt-4 max-w-lg text-base leading-7 text-ink-2 sm:mt-6 sm:text-lg">{description}</p>

            <div className="mt-10 hidden overflow-hidden rounded-card border border-line-2 bg-surface/70 sm:block">
              <div className="grid grid-cols-3 gap-px bg-line-2">
                {[["Slice", "Visible"], ["Excluded", "Visible"], ["External writes", "Disabled"]].map(([label, value]) => (
                  <div key={label} className="bg-surface px-4 py-3">
                    <span className="font-mono text-[11px] uppercase text-muted">{label}</span>
                    <p className="mt-1 text-sm font-semibold text-ink">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="flex min-w-0 w-full justify-center lg:justify-end">{children}</section>
        </div>

        <footer className="flex flex-col gap-2 border-t border-line-2 py-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>Public early access</span>
          <span>Public Repos · Secure authentication by Clerk</span>
        </footer>
      </div>
    </main>
  );
}

export function AuthLoading({ label }: { label: string }) {
  return (
    <div className="flex min-h-80 w-full items-center justify-center rounded-card border border-line-2 bg-surface px-8 text-center shadow-panel" role="status" aria-live="polite">
      <div>
        <Image src="/locus-mark.svg" width={32} height={32} alt="" className="mx-auto" />
        <p className="mt-5 text-sm font-medium text-ink">{label}</p>
        <p className="mt-2 text-xs text-muted">Connecting securely…</p>
      </div>
    </div>
  );
}

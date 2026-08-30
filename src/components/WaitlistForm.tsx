"use client";

import { useEffect, useRef, useState } from "react";

export function nextDialogFocusIndex(
  currentIndex: number,
  focusableCount: number,
  backwards: boolean,
): number {
  if (focusableCount <= 0) return -1;
  if (backwards) return currentIndex <= 0 ? focusableCount - 1 : currentIndex - 1;
  return currentIndex >= focusableCount - 1 ? 0 : currentIndex + 1;
}

export function WaitlistForm({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [useCase, setUseCase] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    const selector = [
      "button:not([disabled])",
      "input:not([disabled])",
      "textarea:not([disabled])",
      "a[href]",
      "[tabindex]:not([tabindex='-1'])",
    ].join(",");

    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLElement>(selector)?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(selector) ?? [],
      );
      if (focusable.length === 0) return;
      const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
      const nextIndex = nextDialogFocusIndex(currentIndex, focusable.length, event.shiftKey);
      event.preventDefault();
      focusable[nextIndex]?.focus();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: name || undefined, company: company || undefined, use_case: useCase || undefined }),
      });
      const data = await res.json();
      setResult({ ok: res.ok || data.ok, message: data.message || data.error });
    } catch {
      setResult({ ok: false, message: "Something went wrong. Try again." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="alpha-access-title"
        aria-describedby="alpha-access-description"
        className="relative w-full max-w-md rounded-2xl border border-line-strong bg-surface p-6 shadow-2xl"
      >
        <button type="button" aria-label="Close alpha access form" onClick={onClose} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-lg text-muted transition hover:bg-ink hover:text-paper">
          <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        {result?.ok ? (
          <div className="py-6 text-center" role="status" aria-live="polite">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-accent" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <p id="alpha-access-title" className="text-lg font-semibold text-paper">{result.message}</p>
            <p id="alpha-access-description" className="sr-only">Your Agent Run access request was received.</p>
            <button type="button" onClick={onClose} className="mt-4 text-sm text-accent hover:underline">Close</button>
          </div>
        ) : (
          <>
            <h2 id="alpha-access-title" className="font-display text-2xl font-semibold tracking-[-0.04em] text-paper">Request Agent Run access</h2>
            <p id="alpha-access-description" className="mt-1 text-sm text-muted-light">Repo localization is already open. Tell us about one public Repo task if you want to test a complete Agent Run; every request is reviewed manually.</p>

            {result && !result.ok && (
              <div role="alert" aria-live="assertive" className="mt-3 rounded-lg border border-recent/30 bg-recent/5 px-4 py-2 text-xs text-recent">{result.message}</div>
            )}

            <form onSubmit={submit} className="mt-5 space-y-4">
              <div>
                <label htmlFor="alpha-access-email" className="mb-1.5 block text-xs font-medium text-muted-light">Email address</label>
                <input
                  id="alpha-access-email"
                  type="email"
                  required
                  autoComplete="email"
                  maxLength={320}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full rounded-xl border border-line-strong bg-ink px-4 py-2.5 text-sm text-paper placeholder:text-muted focus:border-accent/50 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="alpha-access-name" className="mb-1.5 block text-xs font-medium text-muted-light">Name <span className="text-muted">(optional)</span></label>
                <input
                  id="alpha-access-name"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={200}
                  className="w-full rounded-xl border border-line-strong bg-ink px-4 py-2.5 text-sm text-paper focus:border-accent/50 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="alpha-access-company" className="mb-1.5 block text-xs font-medium text-muted-light">Company <span className="text-muted">(optional)</span></label>
                <input
                  id="alpha-access-company"
                  autoComplete="organization"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  maxLength={200}
                  className="w-full rounded-xl border border-line-strong bg-ink px-4 py-2.5 text-sm text-paper focus:border-accent/50 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="alpha-access-use-case" className="mb-1.5 block text-xs font-medium text-muted-light">Public Repo task <span className="text-muted">(optional)</span></label>
                <textarea
                  id="alpha-access-use-case"
                  value={useCase}
                  onChange={(e) => setUseCase(e.target.value)}
                  placeholder="For example: fix a failing CI check"
                  maxLength={1000}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-line-strong bg-ink px-4 py-2.5 text-sm text-paper placeholder:text-muted focus:border-accent/50 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-ink transition hover:bg-accent-dim disabled:opacity-40"
              >
                {submitting ? "Requesting..." : "Request access"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

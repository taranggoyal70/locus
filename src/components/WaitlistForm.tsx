"use client";

import { useEffect, useId, useRef, useState } from "react";

export function WaitlistForm({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [useCase, setUseCase] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    emailRef.current?.focus();
    return () => previousFocus?.focus();
  }, []);

  useEffect(() => {
    if (result?.ok) successHeadingRef.current?.focus();
  }, [result?.ok]);

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href]',
    ) ?? [])].filter((element) => !element.hasAttribute("hidden"));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

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
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 px-0 py-6 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative mx-4 max-h-[calc(100dvh-3rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-line-strong bg-surface p-6 shadow-2xl"
      >
        <button
          onClick={onClose}
          aria-label="Close waitlist form"
          className="absolute right-4 top-4 rounded-md p-1 text-muted hover:text-paper"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        {result?.ok ? (
          <div className="py-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-accent" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <h2
              ref={successHeadingRef}
              id={titleId}
              tabIndex={-1}
              className="text-lg font-semibold text-paper focus:outline-none"
            >
              {result.message}
            </h2>
            <p id={descriptionId} className="mt-2 text-sm text-muted-light">
              Thanks for helping shape the next version of Locus.
            </p>
            <button onClick={onClose} className="mt-4 text-sm text-accent hover:underline">Close</button>
          </div>
        ) : (
          <>
            <h2 id={titleId} className="text-xl font-semibold tracking-[-0.02em] text-paper">Join the Pro waitlist</h2>
            <p id={descriptionId} className="mt-1 text-sm text-muted-light">Private repos, team workspaces, higher limits. We&apos;ll reach out when it&apos;s ready.</p>

            {result && !result.ok && (
              <div role="alert" className="mt-3 rounded-lg border border-recent/30 bg-recent/5 px-4 py-2 text-xs text-recent">{result.message}</div>
            )}

            <form onSubmit={submit} className="mt-5 space-y-3">
              <label htmlFor={`${titleId}-email`} className="sr-only">Work email</label>
              <input
                ref={emailRef}
                id={`${titleId}-email`}
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full rounded-xl border border-line-strong bg-ink px-4 py-2.5 text-sm text-paper placeholder:text-muted focus:border-accent/50 focus:outline-none"
              />
              <label htmlFor={`${titleId}-name`} className="sr-only">Name, optional</label>
              <input
                id={`${titleId}-name`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name (optional)"
                maxLength={200}
                className="w-full rounded-xl border border-line-strong bg-ink px-4 py-2.5 text-sm text-paper placeholder:text-muted focus:border-accent/50 focus:outline-none"
              />
              <label htmlFor={`${titleId}-company`} className="sr-only">Company, optional</label>
              <input
                id={`${titleId}-company`}
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Company (optional)"
                maxLength={200}
                className="w-full rounded-xl border border-line-strong bg-ink px-4 py-2.5 text-sm text-paper placeholder:text-muted focus:border-accent/50 focus:outline-none"
              />
              <label htmlFor={`${titleId}-use-case`} className="sr-only">How do you plan to use Locus? Optional</label>
              <textarea
                id={`${titleId}-use-case`}
                value={useCase}
                onChange={(e) => setUseCase(e.target.value)}
                placeholder="How do you plan to use Locus? (optional)"
                maxLength={1000}
                rows={3}
                className="w-full resize-none rounded-xl border border-line-strong bg-ink px-4 py-2.5 text-sm text-paper placeholder:text-muted focus:border-accent/50 focus:outline-none"
              />
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-accent py-3 text-sm font-semibold text-ink transition hover:bg-[#b5f34a] disabled:opacity-40"
              >
                {submitting ? "Joining..." : "Join waitlist"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

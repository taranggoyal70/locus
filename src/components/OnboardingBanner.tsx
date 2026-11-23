"use client";

import Link from "next/link";
import { useCallback, useSyncExternalStore } from "react";

import type { AdmissionTier } from "@/lib/admission";

const DISMISSED_KEY = "locus.onboarding.dismissed";

type OnboardingProps = {
  tier: AdmissionTier;
  onDismiss?: () => void;
};

/**
 * The four steps, as the viewer's tier actually experiences them.
 *
 * Step three said "Start an invited Run" for everyone, which was true while an
 * invitation was the only way in and is wrong for a free or paid account. The
 * banner exists to teach the workflow, so a step that misdescribes what the
 * reader can do is worse than no banner.
 *
 * Split from the dismissal wrapper so the content stays renderable without a
 * browser. The wrapper's server snapshot is "dismissed", so testing through it
 * would assert against an empty string and pass no matter what the steps said.
 */
export function OnboardingSteps({ tier, onDismiss }: OnboardingProps) {
  const runStep = tier === "visitor" ? "Request Agent Run access" : "Start an Agent Run";
  const steps = ["Load a public Repo", "Describe the task", runStep, "Review the proposal"];

  return (
    <section aria-label="Getting started" className="border-b border-line bg-canvas-2">
      <div className="mx-auto grid max-w-7xl gap-x-10 gap-y-4 px-5 py-5 sm:px-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <p className="flex items-center justify-between gap-4 lg:justify-start">
            <span className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Getting started</span>
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-chip px-2 py-1 text-[13px] text-muted transition-colors duration-150 hover:text-ink lg:hidden"
              aria-label="Dismiss"
            >
              Dismiss
            </button>
          </p>
          <p className="mt-2 max-w-2xl text-[15px] leading-6 text-ink">
            Load a public Repo, describe one concrete engineering outcome, and inspect the Included
            and Excluded evidence before starting a Run.
          </p>
          <ol className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-ink-2">
            {steps.map((step, index) => (
              <li key={step} className="flex items-baseline gap-2">
                <span aria-hidden="true" className="font-mono text-[11px] text-muted tabular-nums">0{index + 1}</span>
                <span aria-hidden="true">{step}</span>
                <span className="sr-only">{index + 1}. {step}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="flex items-center gap-5">
          <Link
            href="/docs"
            className="text-[14px] font-medium text-ink underline decoration-line-2 underline-offset-[5px] transition-colors duration-150 hover:decoration-ink"
          >
            Read the API docs
          </Link>
          <button
            type="button"
            onClick={onDismiss}
            className="hidden rounded-chip px-2 py-1 text-[13px] text-muted transition-colors duration-150 hover:text-ink lg:inline-block"
            aria-label="Dismiss"
          >
            Dismiss
          </button>
        </div>
      </div>
    </section>
  );
}

/**
 * The stored dismissal, as an external store.
 *
 * `useSyncExternalStore` rather than an effect that calls setState: reading
 * localStorage during render is not safe on the server, and writing the answer
 * back from an effect is both a hydration hazard and the pattern the React
 * Compiler lint correctly rejects. This is the API that exists for exactly this
 * shape of problem.
 *
 * The `storage` event only fires in *other* tabs, so dismissing here notifies
 * local subscribers directly. Without that the banner would stay on screen in
 * the tab the user just dismissed it in and vanish everywhere else, which is a
 * memorable way to look broken.
 */
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    // Storage throws outright in some privacy modes. An unreadable preference
    // shows the banner, which is the right way to be wrong: a repeated banner is
    // an annoyance, a missing one is a new user with no instructions.
    return false;
  }
}

/**
 * The banner, dismissed for good rather than until the next page load.
 *
 * Dismissal previously lived in component state, so it reset on every
 * navigation. A "Dismiss" control that does not dismiss is worse than none: it
 * teaches the user their input is ignored, on the first screen they ever see.
 *
 * The server snapshot is "dismissed", so the markup carries no banner and
 * hydration has nothing to reconcile. A returning user therefore never sees it
 * flash before it disappears.
 */
export function OnboardingBanner({ tier }: { tier: AdmissionTier }) {
  const dismissed = useSyncExternalStore(subscribe, readDismissed, () => true);

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Nothing to persist to. The banner returns on the next load, which is
      // better than refusing to close because the preference cannot be saved.
    }
    for (const listener of listeners) listener();
  }, []);

  if (dismissed) return null;

  return <OnboardingSteps tier={tier} onDismiss={dismiss} />;
}

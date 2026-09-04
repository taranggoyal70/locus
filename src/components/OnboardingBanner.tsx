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
  const runStep = tier === "visitor" ? "3. Request Agent Run access" : "3. Start an Agent Run";

  return (
    <div className="mx-auto max-w-7xl px-5 pt-4 sm:px-8">
      <div className="relative overflow-hidden rounded-[18px] border border-accent/20 bg-accent/[0.04] px-5 py-4 sm:px-6">
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-3 top-3 rounded-md px-2 py-1 text-xs text-muted transition hover:text-paper"
          aria-label="Dismiss"
        >
          Dismiss
        </button>
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
          Getting started
        </p>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-paper">
          Load a public Repo, describe one concrete engineering outcome, and inspect the Included
          and Excluded evidence before starting a Run.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          {["1. Load a public Repo", "2. Describe the task", runStep, "4. Review the proposal"].map(
            (step) => (
              <span
                key={step}
                className="rounded-full border border-line-strong px-3 py-1.5 text-muted-light"
              >
                {step}
              </span>
            ),
          )}
          <Link
            href="/docs"
            className="rounded-full border border-accent/30 px-3 py-1.5 text-accent transition hover:bg-accent/10"
          >
            Read the API docs
          </Link>
        </div>
      </div>
    </div>
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

"use client";

import Link from "next/link";
import { useState } from "react";

export function OnboardingBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="mx-auto max-w-7xl px-5 pt-4 sm:px-8">
      <div className="relative overflow-hidden rounded-[18px] border border-accent/20 bg-accent/[0.04] px-5 py-4 sm:px-6">
        <button
          onClick={() => setDismissed(true)}
          className="absolute right-3 top-3 rounded-md px-2 py-1 text-xs text-muted transition hover:text-paper"
          aria-label="Dismiss"
        >
          Dismiss
        </button>
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">Getting started</p>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-paper">
          Load a public Repo, describe one concrete engineering outcome, and inspect the Included
          and Excluded evidence before requesting a limited shared Run.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          <span className="rounded-full border border-line-strong px-3 py-1.5 text-muted-light">
            1. Load a public Repo
          </span>
          <span className="rounded-full border border-line-strong px-3 py-1.5 text-muted-light">
            2. Describe the task
          </span>
          <span className="rounded-full border border-line-strong px-3 py-1.5 text-muted-light">
            3. Start a limited Run
          </span>
          <span className="rounded-full border border-line-strong px-3 py-1.5 text-muted-light">
            4. Review the proposal
          </span>
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

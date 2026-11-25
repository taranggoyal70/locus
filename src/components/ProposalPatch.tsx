"use client";

import { useState } from "react";

import { monoLabel, primaryButton, secondaryButton } from "@/components/controls";
import { InlineError } from "@/components/EmptyState";
import { proposalPatchAvailable, proposalPatchFilename } from "@/lib/agent/run-review";
import type { AgentRunSnapshot } from "@/lib/agent/run-view";

/** Commands that put the patch on its own branch, from the commit the Run read. */
export function patchCommands(runId: string, baseRevision: string): string {
  const filename = proposalPatchFilename(runId);
  return [
    `git switch -c ${filename.replace(/\.patch$/, "").replace("locus-", "locus/")} ${baseRevision.slice(0, 12)}`,
    `git apply --index ~/Downloads/${filename}`,
  ].join("\n");
}

/** Takes a proposal out of Locus: the patch, and how to apply it. */
export function ProposalPatch({ snapshot }: { snapshot: AgentRunSnapshot }) {
  const { run, reviews, artifacts } = snapshot;
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);
  const baseRevision = artifacts.find((artifact) => artifact.kind === "diff")?.base_revision;
  // Runs from before proposals were hashed have nothing a Review can bind to.
  if (run.status === "awaiting_approval" && !run.proposal_hash) {
    return (
      <p className="rounded-card border border-line-2 bg-canvas px-4 py-3 text-[13px] leading-5 text-ink-2">
        This Run finished before Locus kept a fixed copy of each change, so this one cannot be
        accepted or downloaded. Run the task again to get a new one.
      </p>
    );
  }
  if (!baseRevision || !proposalPatchAvailable(run, reviews)) return null;

  const accepted = run.status === "completed";
  const commands = patchCommands(run.id, baseRevision);

  async function download() {
    setDownloading(true);
    setError(null);
    try {
      const response = await fetch(`/api/agent/runs/${run.id}/patch`, { cache: "no-store" });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Could not download the change.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = proposalPatchFilename(run.id);
      link.click();
      // The browser reads the blob after this handler returns.
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not download the change.");
    } finally {
      setDownloading(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(commands);
      setCopied("copied");
    } catch {
      setCopied("failed");
    }
    window.setTimeout(() => setCopied("idle"), 2_200);
  }

  return (
    <section aria-label="Download the change" className="overflow-hidden rounded-card border border-line-2">
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 p-4">
        <div className="min-w-0 flex-1 basis-56">
          <p className={monoLabel}>{accepted ? "Your approved change" : "Optional: try it first"}</p>
          <p className="mt-1.5 text-[14px] leading-6 text-ink-2">
            {accepted
              ? "Download it and apply it to your own copy of the Repo. Locus keeps it for 30 days."
              : "Download the change and apply it to your own copy of the Repo to test it before you decide."}
          </p>
        </div>
        <button
          type="button"
          onClick={download}
          disabled={downloading}
          className={accepted ? primaryButton : secondaryButton}
        >
          {downloading ? "Preparing…" : "Download change"}
        </button>
      </div>
      <details open={accepted} className="group border-t border-line bg-canvas">
        <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-[13px] font-medium text-ink-2 transition-colors duration-150 hover:text-ink">
          How to apply it with git
          <span aria-hidden className="font-mono text-[12px] text-muted transition-transform duration-150 group-open:rotate-90">›</span>
        </summary>
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[13px] leading-5 text-muted">In your copy of the Repo, run:</p>
            <button type="button" onClick={copy} className="-mr-2 rounded-chip px-2 py-1 text-[13px] text-muted transition-colors duration-150 hover:text-ink">
              <span aria-live="polite">{copied === "copied" ? "Copied" : copied === "failed" ? "Copy failed" : "Copy"}</span>
            </button>
          </div>
          <pre tabIndex={0} aria-label="Commands to apply the change" className="mt-2 overflow-x-auto font-mono text-[12px] leading-6 text-ink">{commands}</pre>
        </div>
      </details>
      {error && <InlineError className="border-t border-line p-4">{error}</InlineError>}
    </section>
  );
}

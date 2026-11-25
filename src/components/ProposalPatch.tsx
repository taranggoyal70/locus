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
        throw new Error(data?.error ?? "Could not download the patch.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = proposalPatchFilename(run.id);
      link.click();
      // The browser reads the blob after this handler returns.
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not download the patch.");
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
    <section aria-label="Proposal patch" className="overflow-hidden rounded-card border border-line-2">
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3 p-4">
        <div className="min-w-0 flex-1 basis-56">
          <p className={monoLabel}>{accepted ? "Accepted change" : "Try it before you decide"}</p>
          <p className="mt-1.5 text-[14px] leading-6 text-ink-2">
            {accepted
              ? "Your change, ready to apply to your own checkout. Locus keeps it for 30 days."
              : "Apply the proposal to your own checkout and check the criteria there. It is not reviewed yet."}
          </p>
        </div>
        <button
          type="button"
          onClick={download}
          disabled={downloading}
          className={accepted ? primaryButton : secondaryButton}
        >
          {downloading ? "Preparing…" : "Download patch"}
        </button>
      </div>
      <div className="border-t border-line bg-canvas p-4">
        <div className="flex items-center justify-between gap-4">
          <p className={monoLabel}>Then, in your checkout</p>
          <button type="button" onClick={copy} className="-mr-2 rounded-chip px-2 py-1 text-[13px] text-muted transition-colors duration-150 hover:text-ink">
            <span aria-live="polite">{copied === "copied" ? "Copied" : copied === "failed" ? "Copy failed" : "Copy"}</span>
          </button>
        </div>
        <pre tabIndex={0} aria-label="Commands to apply the patch" className="mt-2 overflow-x-auto font-mono text-[12px] leading-6 text-ink">{commands}</pre>
      </div>
      {error && <InlineError className="border-t border-line p-4">{error}</InlineError>}
    </section>
  );
}

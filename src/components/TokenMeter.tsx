"use client";

import { useState } from "react";

import type { LocateResult, RepoData } from "@/lib/types";

const BUDGET = 40_000;

/** Assemble the slice into one paste-ready context block, token-bounded. */
function packContext(repo: RepoData, result: LocateResult) {
  const parts: string[] = [];
  let tokens = 0;
  let dropped = 0;
  for (const f of result.slice) {
    const content = repo.files[`${repo.root ? repo.root + "/" : ""}${f.rel}`];
    if (content === undefined) continue;
    const t = Math.ceil(content.length / 4);
    if (tokens + t > BUDGET) { dropped += 1; continue; }
    parts.push(`\n\n===== ${f.rel} =====\n${content}`);
    tokens += t;
  }
  const head =
    `# Context for task: ${result.task}\n` +
    `# ${parts.length} file(s), ~${tokens} tokens — localized by Locus` +
    (dropped ? ` (${dropped} dropped for a ${BUDGET.toLocaleString()}-token budget)` : "") +
    `\n`;
  return { text: head + parts.join(""), files: parts.length, tokens };
}

export function TokenMeter({
  result,
  repo,
  sparse,
}: {
  result: LocateResult | null;
  repo: RepoData | null;
  sparse: boolean;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const total = result?.totalTokens ?? 0;
  const slice = result?.sliceTokens ?? total;
  const pct = result && !result.widened ? result.savedPct : 0;
  const sliceFrac = total ? (slice / total) * 100 : 100;

  async function copy() {
    if (!repo || !result) return;
    const packed = packContext(repo, result);
    try {
      await navigator.clipboard.writeText(packed.text);
      setCopied(`Copied ${packed.files} files · ~${packed.tokens.toLocaleString()} tokens`);
      setTimeout(() => setCopied(null), 2500);
    } catch {
      setCopied("Copy failed");
    }
  }

  return (
    <div className="rounded-xl border border-line-strong bg-surface p-5">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Context sent to the agent</p>
          <p className="mt-1 font-mono text-sm text-paper tabular">
            {slice.toLocaleString()} <span className="text-muted">/ {total.toLocaleString()} tokens</span>
          </p>
        </div>
        <div className="text-right">
          <p className={`font-mono text-4xl font-semibold tabular transition-all duration-500 ${sparse && pct > 0 ? "text-muted-light" : "text-accent"}`}>
            {pct > 0 ? `−${pct}%` : "0%"}
          </p>
          <p className="text-[11px] text-muted">fewer tokens</p>
        </div>
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-ink">
        <div
          className={`h-full rounded-full transition-all duration-700 ${sparse ? "bg-muted" : "bg-accent"}`}
          style={{ width: `${Math.max(2, sliceFrac)}%` }}
        />
      </div>

      <p className="mt-2 text-[11px] text-muted">
        {result?.widened
          ? "Whole repo — no confident localization (widen-not-narrow keeps quality safe)."
          : result
            ? `${result.slice.length} files in scope · ${result.excluded.length} excluded`
            : "Pick a repo and describe a task."}
      </p>

      {sparse && !result?.widened && (
        <p className="mt-2 rounded-md border border-recent/30 bg-recent/5 px-2.5 py-1.5 text-[11px] text-recent">
          Sparse repo — few internal imports, so there isn&apos;t much to slice. The number
          reflects structure, not a guaranteed saving. Locus pays off on codebases with real
          dependency depth.
        </p>
      )}

      {result && repo && (
        <button
          onClick={copy}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-accent/90"
        >
          {copied ?? "Copy context for your agent"}
        </button>
      )}
      {result && !result.widened && (
        <p className="mt-2 text-center text-[11px] text-muted">
          Paste this instead of your whole repo — same task, a fraction of the tokens.
        </p>
      )}
    </div>
  );
}

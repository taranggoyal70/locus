"use client";

import type { LocateResult } from "@/lib/types";

export function TokenMeter({ result }: { result: LocateResult | null }) {
  const total = result?.totalTokens ?? 0;
  const slice = result?.sliceTokens ?? total;
  const pct = result && !result.widened ? result.savedPct : 0;
  const sliceFrac = total ? (slice / total) * 100 : 100;

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
          <p className="font-mono text-4xl font-semibold tabular text-accent transition-all duration-500">
            {pct > 0 ? `−${pct}%` : "0%"}
          </p>
          <p className="text-[11px] text-muted">fewer tokens</p>
        </div>
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-ink">
        <div
          className="h-full rounded-full bg-accent transition-all duration-700"
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
    </div>
  );
}

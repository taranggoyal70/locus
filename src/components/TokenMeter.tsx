"use client";

import { useState } from "react";

import { trackClient } from "@/lib/trackClient";
import { fileContent, type LocateResult, type RepoData } from "@/lib/types";

const BUDGET = 40_000;

type ExportFormat = "generic" | "claude" | "cursor";

function sparseGraphWarning(result: LocateResult) {
  if (!result.sparse || result.widened) return null;
  return (
    `warning: few internal imports resolved (${result.edgeDensity.toFixed(2)} edges/file), ` +
    `so this Slice may be missing real dependencies and the reduction may be overstated`
  );
}

export function packContext(repo: RepoData, result: LocateResult, format: ExportFormat = "generic") {
  const parts: string[] = [];
  let tokens = 0;
  let dropped = 0;
  for (const f of result.slice) {
    const content = fileContent(repo, f.rel);
    if (content === undefined) continue;
    const t = Math.ceil(content.length / 4);
    if (tokens + t > BUDGET) { dropped += 1; continue; }
    // Label with the repo-relative path: this block gets pasted into an agent
    // working on a real checkout, where the source-root-relative spelling does
    // not exist. `fileContent` still looks up by `rel`, which is its key.
    if (format === "cursor") {
      parts.push(`\n\n// File: ${f.path}\n${content}`);
    } else {
      parts.push(`\n\n===== ${f.path} =====\n${content}`);
    }
    tokens += t;
  }

  let head: string;
  if (format === "claude") {
    head =
      `<context task="${result.task}">\n` +
      `<!-- ${parts.length} file(s), ~${tokens} tokens — localized by Locus -->\n`;
    const warning = sparseGraphWarning(result);
    if (warning) head += `<!-- ${warning} -->\n`;
  } else if (format === "cursor") {
    head =
      `// Context for: ${result.task}\n` +
      `// ${parts.length} file(s), ~${tokens} tokens — localized by Locus\n`;
    const warning = sparseGraphWarning(result);
    if (warning) head += `// ${warning}\n`;
  } else {
    head =
      `# Context for task: ${result.task}\n` +
      `# ${parts.length} file(s), ~${tokens} tokens — localized by Locus\n`;
    const warning = sparseGraphWarning(result);
    if (warning) head += `# ${warning}\n`;
  }

  let tail = "";
  if (dropped) tail = `\n\n# ${dropped} file(s) omitted — exceeded ${BUDGET.toLocaleString()}-token budget`;
  if (format === "claude") tail += "\n</context>";

  return { text: head + parts.join("") + tail, files: parts.length, tokens };
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
  const [format, setFormat] = useState<ExportFormat>("generic");
  const [feedback, setFeedback] = useState<"none" | "up" | "down">("none");
  const total = result?.totalTokens ?? 0;
  const slice = result?.sliceTokens ?? total;
  const sliceFrac = total ? (slice / total) * 100 : 100;
  const includedShare = Math.round(sliceFrac);

  async function copy() {
    if (!repo || !result) return;
    const packed = packContext(repo, result, format);
    try {
      await navigator.clipboard.writeText(packed.text);
      setCopied(`Copied ${packed.files} files · ~${packed.tokens.toLocaleString()} tokens`);
      trackClient("context_copied", { format, files: packed.files, tokens: packed.tokens });
      setTimeout(() => setCopied(null), 2500);
    } catch {
      setCopied("Copy failed");
    }
  }

  return (
    <div className="rounded-card border border-line-2 bg-surface p-5 shadow-panel">
      <div className="flex items-end justify-between">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Context sent to the agent</p>
          <p className="mt-1 font-mono text-sm text-ink tabular">
            {slice.toLocaleString()} <span className="text-muted">/ {total.toLocaleString()} tokens</span>
          </p>
        </div>
        <div className="text-right">
          <p className={`font-mono text-4xl font-semibold tabular transition-all duration-500 ${sparse ? "text-ink-2" : "text-included"}`}>
            {result ? `${includedShare}%` : "·"}
          </p>
          <p className="text-[11px] text-muted">included share</p>
        </div>
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-canvas">
        <div
          className={`h-full rounded-full transition-all duration-700 ${sparse ? "bg-muted" : "bg-included"}`}
          style={{ width: `${Math.max(2, sliceFrac)}%` }}
        />
      </div>

      <p className="mt-2 text-[11px] text-muted">
        {result?.widened
          ? "The full repository is included. Add a file, symbol, route, or error message to focus the Slice."
          : result
            ? `${result.slice.length} files in the Slice · ${result.excluded.length} excluded`
            : "Pick a repo and describe a task."}
      </p>

      {sparse && !result?.widened && (
        <p className="mt-2 rounded-chip border border-widened/30 bg-widened/5 px-2.5 py-1.5 text-[11px] text-widened">
          Few internal imports resolved, so this Slice may be missing real dependencies and the
          reduction above may be overstated. Treat it as repository structure rather than proven
          localization.
        </p>
      )}

      {result && repo && (
        <>
          <div className="mt-4 flex gap-1 rounded-chip border border-line p-1">
            {([["generic", "Generic"], ["claude", "Claude"], ["cursor", "Cursor"]] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFormat(key)}
                className={`flex-1 rounded-chip px-2 py-1.5 text-[11px] font-medium transition ${
                  format === key ? "bg-included/15 text-included" : "text-muted hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <button
              onClick={copy}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-card px-4 py-3 text-sm font-semibold transition ${
                result.widened
                  ? "border border-line-2 bg-canvas text-ink-2 hover:border-ink/40 hover:text-ink"
                  : "bg-ink text-canvas shadow-panel hover:bg-ink/90"
              }`}
            >
              {copied ?? (result.widened ? "Copy full repo context" : "Copy context")}
            </button>
            <button
              onClick={() => {
                if (!repo || !result) return;
                const packed = packContext(repo, result, format);
                const ext = format === "claude" ? "xml" : "md";
                const blob = new Blob([packed.text], { type: "text/plain" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `locus-context.${ext}`;
                a.click();
                URL.revokeObjectURL(a.href);
                trackClient("context_copied", { format, files: packed.files, tokens: packed.tokens, method: "download" });
              }}
              className="rounded-card border border-line-2 px-3 py-3 text-sm text-ink-2 transition hover:border-ink/40 hover:text-ink"
              title="Download as file"
            >
              ↓
            </button>
          </div>
        </>
      )}
      {result && !result.widened && (
        <div className="mt-3 flex items-center justify-center gap-3">
          <span className="text-[11px] text-muted">Was this context useful?</span>
          <button
            onClick={() => { setFeedback("up"); trackClient("context_feedback", { rating: "up", files: result.slice.length, includedTokens: result.sliceTokens, totalTokens: result.totalTokens }); }}
            className={`rounded-chip px-2 py-1 text-xs transition ${feedback === "up" ? "bg-included/15 text-included" : "text-muted hover:text-ink"}`}
          >
            Yes
          </button>
          <button
            onClick={() => { setFeedback("down"); trackClient("context_feedback", { rating: "down", files: result.slice.length, includedTokens: result.sliceTokens, totalTokens: result.totalTokens }); }}
            className={`rounded-chip px-2 py-1 text-xs transition ${feedback === "down" ? "bg-failed/15 text-failed" : "text-muted hover:text-ink"}`}
          >
            No
          </button>
        </div>
      )}
    </div>
  );
}

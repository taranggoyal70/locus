"use client";

import { useMemo, useState } from "react";

import { trackClient } from "@/lib/trackClient";
import { fileContent, type LocateResult, type RepoData } from "@/lib/types";

const BUDGET = 40_000;

type ExportFormat = "generic" | "claude" | "cursor";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function packContext(repo: RepoData, result: LocateResult, format: ExportFormat = "generic") {
  const parts: string[] = [];
  let tokens = 0;
  let dropped = 0;
  for (const f of result.slice) {
    const content = fileContent(repo, f.rel);
    if (content === undefined) continue;
    const t = Math.ceil(content.length / 4);
    if (tokens + t > BUDGET) { dropped += 1; continue; }
    if (format === "claude") {
      const cdata = content.replaceAll("]]>", "]]]]><![CDATA[>");
      parts.push(`\n    <document path="${escapeXml(f.rel)}"><![CDATA[\n${cdata}\n]]></document>`);
    } else if (format === "cursor") {
      parts.push(`\n\n// File: ${f.rel}\n${content}`);
    } else {
      parts.push(`\n\n===== ${f.rel} =====\n${content}`);
    }
    tokens += t;
  }

  let head: string;
  if (format === "claude") {
    head =
      `<context>\n` +
      `  <task>${escapeXml(result.task)}</task>\n` +
      `  <documents count="${parts.length}" estimated-tokens="${tokens}">`;
  } else if (format === "cursor") {
    head =
      `// Context for: ${result.task}\n` +
      `// ${parts.length} file(s), ~${tokens} tokens — localized by Locus\n`;
  } else {
    head =
      `# Context for task: ${result.task}\n` +
      `# ${parts.length} file(s), ~${tokens} tokens — localized by Locus\n`;
  }

  let tail = format === "claude" ? "\n  </documents>" : "";
  if (dropped) {
    const prefix = format === "claude" ? "<!--" : format === "cursor" ? "//" : "#";
    const suffix = format === "claude" ? " -->" : "";
    tail += `\n\n${prefix} ${dropped} file(s) omitted — exceeded ${BUDGET.toLocaleString()}-token budget${suffix}`;
  }
  if (format === "claude") tail += "\n</context>";

  return { text: head + parts.join("") + tail, files: parts.length, tokens, dropped };
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
  const pct = result && !result.widened ? result.savedPct : 0;
  const sliceFrac = total ? (slice / total) * 100 : 100;
  const exportPreview = useMemo(
    () => (repo && result ? packContext(repo, result, format) : null),
    [format, repo, result],
  );

  async function copy() {
    if (!repo || !result) return;
    const packed = packContext(repo, result, format);
    try {
      await navigator.clipboard.writeText(packed.text);
      setCopied(
        packed.dropped
          ? `Copied ${packed.files} files · ${packed.dropped} omitted`
          : `Copied ${packed.files} files · ~${packed.tokens.toLocaleString()} tokens`,
      );
      trackClient("context_copied", {
        format,
        files: packed.files,
        tokens: packed.tokens,
        dropped: packed.dropped,
      });
      setTimeout(() => setCopied(null), 2500);
    } catch {
      setCopied("Copy failed");
    }
  }

  return (
    <div className="rounded-[20px] border border-line-strong bg-surface p-5 shadow-[0_24px_80px_rgba(0,0,0,0.16)]">
      <div className="flex items-end justify-between">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Context selected</p>
          <p className="mt-1 font-mono text-sm text-paper tabular">
            {slice.toLocaleString()} <span className="text-muted">/ {total.toLocaleString()} tokens</span>
          </p>
        </div>
        <div className="text-right">
          <p className={`font-mono text-4xl font-semibold tabular transition-all duration-500 ${sparse && pct > 0 ? "text-muted-light" : "text-accent"}`}>
            {result?.widened ? "All loaded" : pct > 0 ? `−${pct}%` : "0%"}
          </p>
          <p className="text-[11px] text-muted">{result?.widened ? "safe Widen" : "fewer tokens"}</p>
        </div>
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-ink">
        <div
          className={`h-full rounded-full transition-all duration-700 ${sparse ? "bg-muted" : "bg-accent"}`}
          style={{ width: `${Math.max(2, sliceFrac)}%` }}
          role="progressbar"
          aria-label="Repository context included"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(Math.min(100, sliceFrac))}
        />
      </div>

      <p className="mt-2 text-[11px] text-muted">
        {result?.widened
          ? "No reduction yet—add a file, symbol, route, or error message to focus the Slice."
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
        <>
          <div className="mt-4 flex gap-1 rounded-lg border border-line p-1">
            {([["generic", "Generic"], ["claude", "Claude"], ["cursor", "Cursor"]] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFormat(key)}
                aria-pressed={format === key}
                className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition ${
                  format === key ? "bg-accent/15 text-accent" : "text-muted hover:text-paper"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {exportPreview && (
            <p className="mt-2 text-[11px] text-muted">
              Export: {exportPreview.files} file{exportPreview.files === 1 ? "" : "s"} · ~{exportPreview.tokens.toLocaleString()} tokens
              {exportPreview.dropped > 0 ? ` · ${exportPreview.dropped} omitted by the ${BUDGET.toLocaleString()}-token budget` : ""}
            </p>
          )}
          <div className="mt-2 flex gap-2">
            <button
              onClick={copy}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                result.widened
                  ? "border border-line-strong bg-ink text-muted-light hover:border-accent/40 hover:text-paper"
                  : "bg-accent text-ink hover:bg-[#b5f34a]"
              }`}
            >
              {copied ??
                (exportPreview?.dropped
                  ? `Copy ${exportPreview.files} of ${exportPreview.files + exportPreview.dropped} files`
                  : result.widened
                    ? "Copy all loaded files"
                    : "Copy context")}
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
                trackClient("context_copied", {
                  format,
                  files: packed.files,
                  tokens: packed.tokens,
                  dropped: packed.dropped,
                  method: "download",
                });
              }}
              className="rounded-xl border border-line-strong px-3 py-3 text-sm text-muted-light transition hover:border-accent/40 hover:text-paper"
              title="Download as file"
              aria-label="Download context as a file"
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
            onClick={() => { setFeedback("up"); trackClient("context_feedback", { rating: "up", files: result.slice.length, savedPct: result.savedPct }); }}
            aria-pressed={feedback === "up"}
            className={`rounded-md px-2 py-1 text-xs transition ${feedback === "up" ? "bg-accent/15 text-accent" : "text-muted hover:text-paper"}`}
          >
            Yes
          </button>
          <button
            onClick={() => { setFeedback("down"); trackClient("context_feedback", { rating: "down", files: result.slice.length, savedPct: result.savedPct }); }}
            aria-pressed={feedback === "down"}
            className={`rounded-md px-2 py-1 text-xs transition ${feedback === "down" ? "bg-recent/15 text-recent" : "text-muted hover:text-paper"}`}
          >
            No
          </button>
        </div>
      )}
    </div>
  );
}

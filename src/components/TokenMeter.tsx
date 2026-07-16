"use client";

import { useState } from "react";

import { trackClient } from "@/lib/trackClient";
import { fileContent, type LocateResult, type RepoData } from "@/lib/types";

const BUDGET = 40_000;

type ExportFormat = "generic" | "claude" | "cursor";

function packContext(repo: RepoData, result: LocateResult, format: ExportFormat = "generic") {
  const parts: string[] = [];
  let tokens = 0;
  let dropped = 0;
  for (const f of result.slice) {
    const content = fileContent(repo, f.rel);
    if (content === undefined) continue;
    const t = Math.ceil(content.length / 4);
    if (tokens + t > BUDGET) { dropped += 1; continue; }
    if (format === "cursor") {
      parts.push(`\n\n// File: ${f.rel}\n${content}`);
    } else {
      parts.push(`\n\n===== ${f.rel} =====\n${content}`);
    }
    tokens += t;
  }

  let head: string;
  if (format === "claude") {
    head =
      `<context task="${result.task}">\n` +
      `<!-- ${parts.length} file(s), ~${tokens} tokens — localized by Locus -->\n`;
  } else if (format === "cursor") {
    head =
      `// Context for: ${result.task}\n` +
      `// ${parts.length} file(s), ~${tokens} tokens — localized by Locus\n`;
  } else {
    head =
      `# Context for task: ${result.task}\n` +
      `# ${parts.length} file(s), ~${tokens} tokens — localized by Locus\n`;
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
  const total = result?.totalTokens ?? 0;
  const slice = result?.sliceTokens ?? total;
  const pct = result && !result.widened ? result.savedPct : 0;
  const sliceFrac = total ? (slice / total) * 100 : 100;

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
    <div className="rounded-[20px] border border-line-strong bg-surface p-5 shadow-[0_24px_80px_rgba(0,0,0,0.16)]">
      <div className="flex items-end justify-between">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">Context sent to the agent</p>
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
          ? "Whole repo — Locus did not find enough evidence for a focused slice."
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
                className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition ${
                  format === key ? "bg-accent/15 text-accent" : "text-muted hover:text-paper"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={copy}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-ink transition hover:bg-[#b5f34a]"
          >
            {copied ?? "Copy context for your agent"}
          </button>
        </>
      )}
      {result && !result.widened && (
        <p className="mt-2 text-center text-[11px] text-muted">
          Paste this instead of your whole repo — same task, a fraction of the tokens.
        </p>
      )}
    </div>
  );
}

"use client";

import type { LocateResult, RepoData } from "@/lib/types";

export function FilePanel({
  result,
  repo,
  selected,
  onSelect,
}: {
  result: LocateResult | null;
  repo: RepoData | null;
  selected: string | null;
  onSelect: (rel: string | null) => void;
}) {
  if (!result) return null;

  const selectedContent =
    selected && repo ? repo.files[`${repo.root ? repo.root + "/" : ""}${selected}`] : null;

  return (
    <div className="rounded-xl border border-line bg-surface/60">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          {result.widened ? "All files (widened)" : "In scope · ranked by relevance"}
        </p>
        {selected && (
          <button onClick={() => onSelect(null)} className="text-[11px] text-muted hover:text-paper">
            ← back to list
          </button>
        )}
      </div>

      {selected && selectedContent ? (
        <div>
          <p className="border-b border-line px-4 py-2 font-mono text-[11px] text-accent">{selected}</p>
          <pre className="max-h-[420px] overflow-auto p-4 font-mono text-[11px] leading-relaxed text-muted-light">
            {selectedContent}
          </pre>
        </div>
      ) : (
        <ul className="max-h-[420px] divide-y divide-line overflow-auto">
          {result.slice.map((f) => (
            <li key={f.rel}>
              <button
                onClick={() => onSelect(f.rel)}
                className="flex w-full items-center gap-3 px-4 py-2 text-left transition hover:bg-white/[0.03]"
              >
                {!result.widened && (
                  <span
                    className={`w-4 shrink-0 text-center font-mono text-[10px] ${
                      result.anchors.includes(f.rel) ? "text-accent" : "text-muted"
                    }`}
                  >
                    {result.anchors.includes(f.rel) ? "◎" : f.dist}
                  </span>
                )}
                <span className="flex-1 truncate font-mono text-[12px] text-paper">{f.rel}</span>
                {f.recent && (
                  <span className="shrink-0 rounded-full bg-recent/15 px-1.5 py-0.5 text-[9px] font-semibold text-recent">
                    changed
                  </span>
                )}
                <span className="shrink-0 font-mono text-[10px] text-muted tabular">{f.tokens}t</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!result.widened && result.excluded.length > 0 && !selected && (
        <div className="border-t border-line px-4 py-3">
          <p className="text-[11px] text-muted">
            <span className="font-semibold text-muted-light">{result.excluded.length} files excluded</span>{" "}
            (never read): <span className="font-mono">{result.excluded.slice(0, 8).join(", ")}</span>
            {result.excluded.length > 8 ? " …" : ""}
          </p>
        </div>
      )}
    </div>
  );
}

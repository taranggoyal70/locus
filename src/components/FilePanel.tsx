"use client";

import { useEffect, useRef, useState } from "react";

import { fileContent, type LocateResult, type RepoData } from "@/lib/types";

type FilePanelView = "included" | "excluded";

export function ExcludedFileList({
  files,
  onSelect,
}: {
  files: string[];
  onSelect: (rel: string) => void;
}) {
  return (
    <ul
      id="file-panel-excluded"
      aria-label="Excluded files"
      className="max-h-[320px] divide-y divide-line overflow-auto sm:max-h-[420px]"
    >
      {files.map((rel) => (
        <li key={rel}>
          <button
            data-file-path={rel}
            onClick={() => onSelect(rel)}
            className="group flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-surface-2"
          >
            <span className="w-12 shrink-0 font-mono text-[11px] uppercase tracking-wide text-muted">
              out
            </span>
            <span className="min-w-0 flex-1 break-all font-mono text-[12px] text-ink-2 transition group-hover:text-ink">
              {rel}
            </span>
            <span className="shrink-0 font-mono text-[11px] uppercase tracking-wide text-muted">
              not packed
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

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
  const detailHeadingRef = useRef<HTMLParagraphElement>(null);
  const listHeadingRef = useRef<HTMLParagraphElement>(null);
  const lastSelectedRef = useRef<string | null>(null);
  const hadSelectionRef = useRef(false);
  const [view, setView] = useState<FilePanelView>("included");

  useEffect(() => {
    if (selected) {
      hadSelectionRef.current = true;
      detailHeadingRef.current?.focus();
      return;
    }
    if (!hadSelectionRef.current) return;
    hadSelectionRef.current = false;
    if (lastSelectedRef.current) {
      const previousButton = document.querySelector<HTMLButtonElement>(
        `[data-file-path="${CSS.escape(lastSelectedRef.current)}"]`,
      );
      if (previousButton) {
        previousButton.focus();
        return;
      }
    }
    listHeadingRef.current?.focus();
  }, [selected]);

  if (!result) return null;

  const canShowExcluded = !result.widened && result.excluded.length > 0;
  const activeView = canShowExcluded ? view : "included";
  const selectedView: FilePanelView = selected && result.excluded.includes(selected)
    ? "excluded"
    : "included";
  const displayView = selected ? selectedView : activeView;
  const selectedContent = selected && repo ? fileContent(repo, selected) : undefined;

  function switchView(nextView: FilePanelView) {
    if (nextView === "excluded" && !canShowExcluded) return;
    setView(nextView);
    onSelect(null);
  }

  return (
    <div className="overflow-hidden rounded-card border border-line-2 bg-surface">
      <div className="flex flex-col gap-3 border-b border-line px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <p
            ref={listHeadingRef}
            tabIndex={-1}
            className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted focus:outline-none"
          >
            {result.widened
              ? "All files retained · refine the task"
              : displayView === "included"
                ? "In the Slice · ranked by relevance"
                : "Left out · open any file to inspect it"}
          </p>
          {selected && (
            <button
              onClick={() => {
                setView(selectedView);
                onSelect(null);
              }}
              className="shrink-0 text-[13px] text-muted transition-colors duration-150 hover:text-ink"
            >
              Back to {selectedView} list
            </button>
          )}
        </div>

        <div
          role="group"
          aria-label="Context file sets"
          className="grid grid-cols-2 rounded-card border border-line bg-canvas/50 p-1"
        >
          <button
            type="button"
            aria-pressed={displayView === "included"}
            onClick={() => switchView("included")}
            className={`flex items-center justify-between rounded-chip px-3 py-2 text-left text-[13px] transition-colors duration-150 ${
              displayView === "included"
                ? "bg-included/[0.09] text-included-ink"
                : "text-muted hover:text-ink-2"
            }`}
          >
            <span className="font-medium">Included</span>
            <span className="font-mono text-[12px] tabular-nums">{result.slice.length}</span>
          </button>
          <button
            type="button"
            aria-pressed={displayView === "excluded"}
            disabled={!canShowExcluded}
            onClick={() => switchView("excluded")}
            className={`flex items-center justify-between rounded-chip px-3 py-2 text-left text-[13px] transition-colors duration-150 ${
              displayView === "excluded"
                ? "bg-surface-2 text-ink"
                : "text-muted hover:text-ink-2 disabled:cursor-not-allowed disabled:opacity-40"
            }`}
          >
            <span className="font-medium">Excluded</span>
            <span className="font-mono text-[12px] tabular-nums">{result.excluded.length}</span>
          </button>
        </div>
      </div>

      {selected && selectedContent !== undefined ? (
        <div role="region" aria-labelledby="file-panel-detail-heading">
          <p
            id="file-panel-detail-heading"
            ref={detailHeadingRef}
            tabIndex={-1}
            className={`border-b border-line px-4 py-2 font-mono text-[12px] break-all focus:outline-none ${
              selectedView === "included" ? "text-included-ink" : "text-ink-2"
            }`}
          >
            {selected}
          </p>
          <pre className="max-h-[320px] overflow-auto p-4 font-mono text-[11px] leading-relaxed text-ink-2 sm:max-h-[420px]" tabIndex={0}>
            {selectedContent}
          </pre>
        </div>
      ) : activeView === "included" ? (
        <ul
          id="file-panel-included"
          aria-label="Included files"
          className="max-h-[320px] divide-y divide-line overflow-auto sm:max-h-[420px]"
        >
          {result.slice.map((f) => (
            <li key={f.rel}>
              <button
                data-file-path={f.rel}
                onClick={() => {
                  lastSelectedRef.current = f.rel;
                  onSelect(f.rel);
                }}
                className="flex w-full items-center gap-3 px-4 py-2 text-left transition hover:bg-surface-2"
              >
                {!result.widened && (
                  <span
                    className="w-12 shrink-0 font-mono text-[11px] uppercase tracking-wide text-muted"
                  >
                    {result.anchors.includes(f.rel) ? "match" : `${f.dist} ${f.dist === 1 ? "hop" : "hops"}`}
                  </span>
                )}
                <span className="flex-1 truncate font-mono text-[12px] text-ink">{f.rel}</span>
                {f.recent && (
                  <span className="shrink-0 rounded-chip bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-ink-2">
                    changed
                  </span>
                )}
                <span className="shrink-0 font-mono text-[11px] text-muted tabular">{f.tokens}t</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <ExcludedFileList
          files={result.excluded}
          onSelect={(rel) => {
            lastSelectedRef.current = rel;
            onSelect(rel);
          }}
        />
      )}

      {activeView === "excluded" && !selected && (
        <div className="border-t border-dashed border-line-2 bg-canvas/30 px-4 py-3">
          <p className="text-[13px] leading-5 text-muted">
            These files were loaded but not sent in the context pack. Opening one is inspection only; it does not change the Slice.
          </p>
        </div>
      )}
    </div>
  );
}

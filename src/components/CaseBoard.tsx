"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { PathText } from "@/components/PathText";
import type { BenchmarkCase } from "@/lib/benchmark-cases";

const label = "font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted";
const link = "text-ink underline decoration-line-2 underline-offset-2 transition-colors hover:decoration-ink";

type MarkKind = "fix" | "admitted" | "missed" | "excluded";

const LEGEND: Array<[MarkKind, string]> = [
  ["fix", "Changed by the fix"],
  ["admitted", "Admitted to the Slice"],
  ["missed", "Missed by the Slice"],
  ["excluded", "Held outside"],
];

/**
 * One mark per source file in the snapshot, as runs: the fix's files the Slice
 * found, the rest of the Slice, any fix file it missed, then everything held
 * outside. Each run is one element drawing its marks as a repeating tile
 * (globals.css), so a row costs four elements, not one per file.
 */
function markRuns(item: BenchmarkCase): Array<[MarkKind, number]> {
  const found = item.found.length;
  const missed = Math.max(0, item.fixFiles.length - found);
  const runs: Array<[MarkKind, number]> = [
    ["fix", found],
    ["admitted", item.admitted - found],
    ["missed", missed],
    ["excluded", item.total - item.admitted - missed],
  ];
  return runs.filter(([, count]) => count > 0);
}

const repoName = (repo: string) => repo.split("/").pop() ?? repo;
const caseNumber = (index: number) => String(index + 1).padStart(2, "0");

/**
 * Fig. 3: every case in the historical-task benchmark, inspectable. Each row is
 * one fix, drawn as one mark per source file on a shared scale, so a 15-file
 * Repo is visibly a quarter the length of a 61-file one. Hovering, focusing or
 * tapping a row opens its details: beside the list on wide screens, under the
 * row on narrow ones. Arrow keys step through the cases.
 */
export function CaseBoard({ cases }: { cases: BenchmarkCase[] }) {
  const [selected, setSelected] = useState(() => (cases.find((item) => item.featured) ?? cases[0])?.commit);
  const specId = useId();
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const scale = Math.max(...cases.map((item) => item.total));
  const anyMissed = cases.some((item) => item.found.length < item.fixFiles.length);

  const groups = useMemo(() => {
    const repos = [...new Set(cases.map((item) => item.repo))];
    return repos.map((repo) => ({
      repo,
      rows: cases.flatMap((item, index) => (item.repo === repo ? [{ item, index }] : [])),
    }));
  }, [cases]);

  const currentIndex = Math.max(0, cases.findIndex((item) => item.commit === selected));
  const current = cases[currentIndex];
  if (!current) return null;

  const step = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = {
      ArrowDown: index + 1,
      ArrowUp: index - 1,
      Home: 0,
      End: cases.length - 1,
    }[event.key];
    if (next === undefined || next < 0 || next >= cases.length || next === index) return;
    event.preventDefault();
    setSelected(cases[next].commit);
    buttons.current[next]?.focus();
  };

  return (
    <div className="overflow-hidden rounded-card border border-line-2 bg-surface shadow-panel">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line px-5 py-3.5 sm:px-6">
        {LEGEND.filter(([kind]) => kind !== "missed" || anyMissed).map(([kind, text]) => (
          <span key={kind} className="inline-flex items-center gap-2 text-[13px] text-ink-2">
            <span aria-hidden="true" className="case-mark w-2.5" data-kind={kind} />
            {text}
          </span>
        ))}
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* The list is a size container: every row's mark size is set from its width, on one scale. */}
        <div className="case-list min-w-0" style={{ "--scale": scale } as React.CSSProperties}>
          <div aria-hidden="true" className="grid grid-cols-[24px_minmax(0,1fr)_auto] gap-x-3 border-b border-line px-5 py-2.5 sm:px-6">
            <span className={label}>#</span>
            <span className={label}>Task, one mark per file</span>
            <span className={label}>Reduction</span>
          </div>

          {groups.map(({ repo, rows }) => (
            <div key={repo}>
              <p className="border-b border-line bg-canvas/50 px-5 py-2 font-mono text-[11px] text-muted sm:px-6">
                <span className="font-medium text-ink-2">{repoName(repo)}</span> · {rows.length} {rows.length === 1 ? "fix" : "fixes"}
              </p>
              <ul className="divide-y divide-line border-b border-line last:border-b-0">
                {rows.map(({ item, index }) => {
                  const isSelected = index === currentIndex;
                  return (
                    <li key={item.commit}>
                      <button
                        ref={(node) => {
                          buttons.current[index] = node;
                        }}
                        type="button"
                        aria-expanded={isSelected}
                        aria-controls={`${specId} ${specId}-inline`}
                        onClick={() => setSelected(item.commit)}
                        onPointerEnter={(event) => {
                          if (event.pointerType === "mouse") setSelected(item.commit);
                        }}
                        onKeyDown={(event) => step(event, index)}
                        className={`grid w-full grid-cols-[24px_minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-2 px-5 py-3 text-left transition-colors duration-150 sm:px-6 ${
                          isSelected ? "bg-surface-2 shadow-[inset_2px_0_0_var(--ink)]" : "hover:bg-surface-2/60"
                        }`}
                      >
                        <span className="font-mono text-[11px] text-muted tabular-nums">{caseNumber(index)}</span>
                        <span className={`truncate text-[14px] ${isSelected ? "text-ink" : "text-ink-2"}`}>{item.task}</span>
                        <span className={`font-mono text-[12px] tabular-nums ${item.widened ? "text-widened" : "text-ink"}`}>
                          {item.widened ? "Widened" : `${item.reductionPct}%`}
                          {!item.widened && <span className="sr-only"> estimated context reduction</span>}
                        </span>
                        <span aria-hidden="true" className="case-strip col-start-2 col-end-4">
                          {markRuns(item).map(([kind, count]) => (
                            <span key={kind} className="case-run" data-kind={kind} style={{ "--n": count } as React.CSSProperties} />
                          ))}
                        </span>
                        <span className="sr-only">
                          {`, ${item.admitted} of ${item.total} files admitted, ${item.found.length} of ${item.fixFiles.length} fix files found`}
                        </span>
                      </button>
                      {isSelected && (
                        <div className="border-t border-line bg-canvas/40 px-5 py-5 sm:px-6 lg:hidden">
                          <CaseSpec id={`${specId}-inline`} item={item} number={caseNumber(index)} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <aside aria-label="Case details" className="hidden border-l border-line lg:block">
          <div className="sticky top-[84px] p-6">
            <CaseSpec id={specId} item={current} number={caseNumber(currentIndex)} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function CaseSpec({ id, item, number }: { id: string; item: BenchmarkCase; number: string }) {
  const base = `https://github.com/${item.repo}`;
  const found = new Set(item.found);
  return (
    <div id={id}>
      <div className="flex items-center justify-between gap-3">
        <p className={label}>
          Case {number} · {repoName(item.repo)}
        </p>
        {item.widened && (
          <span className="rounded-chip border border-widened/40 px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-widened">
            Widened
          </span>
        )}
      </div>
      <h3 className="mt-3 font-display text-[22px] font-normal leading-[1.15] tracking-[-0.01em] text-ink">{item.task}</h3>

      <dl className="mt-5 grid grid-cols-3 border-y border-line">
        {[
          ["Admitted", <>{item.admitted}<span className="font-normal text-muted"> / {item.total}</span></>],
          ["Reduction", `${item.reductionPct}%`],
          ["Fix found", `${item.found.length} / ${item.fixFiles.length}`],
        ].map(([term, value], index) => (
          <div key={index} className={`py-3 ${index === 0 ? "pr-3" : "border-l border-line pl-3"}`}>
            <dt className="font-mono text-[11px] text-muted">{term}</dt>
            <dd className="mt-1 text-[15px] font-semibold text-ink tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <p className={`mt-5 ${label}`}>Changed by the fix</p>
      <ul className="mt-2 space-y-1.5">
        {item.fixFiles.map((file) => (
          <li key={file} className="flex gap-2 font-mono text-[11px] leading-5 text-ink">
            <span aria-hidden="true" className="case-mark mt-[5px] w-2.5 shrink-0" data-kind={found.has(file) ? "fix" : "missed"} />
            <span className="min-w-0 [overflow-wrap:anywhere]">
              <PathText path={file} />
              <span className="sr-only">{found.has(file) ? ", in the Slice" : ", missed by the Slice"}</span>
            </span>
          </li>
        ))}
      </ul>

      {item.widened ? (
        <p className="mt-5 border-l-2 border-widened pl-3 text-[13px] leading-5 text-ink-2">
          No Anchor matched with enough evidence, so Locus admitted the whole Repo instead of guessing. A whole-Repo
          fallback contains every fix file by definition.
        </p>
      ) : item.anchors.length > 0 && (
        <>
          <p className={`mt-5 ${label}`}>Anchors</p>
          <ul className="mt-2 space-y-1">
            {item.anchors.map((anchor) => (
              <li key={anchor} className="font-mono text-[11px] leading-5 text-ink-2 [overflow-wrap:anywhere]">
                <PathText path={anchor} />
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mt-5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px]">
        <a href={`${base}/commit/${item.commit}`} className={link}>
          Fix {item.commit}<span aria-hidden="true"> ↗</span>
        </a>
        <a href={`${base}/tree/${item.snapshot}`} className={link}>
          Snapshot {item.snapshot}<span aria-hidden="true"> ↗</span>
        </a>
      </p>
    </div>
  );
}

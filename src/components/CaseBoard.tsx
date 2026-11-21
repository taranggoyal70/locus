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
 * One mark per percent of the Repo's source files, so every row is the same
 * length whether the Repo has 36 files or 1,208.
 */
export const MARKS = 100;

/**
 * A row's marks, as runs: the fix's files the Slice found, the rest of the
 * Slice, any fix file it missed, then everything held outside. Each kind takes
 * its share of the Repo's files in whole marks, and no kind present is ever
 * rounded away: a fix file always takes a mark, and so does a file left out.
 * Each run is one element drawing its marks as a repeating tile (globals.css),
 * so a row costs four elements at most.
 */
export function markRuns(item: BenchmarkCase): Array<[MarkKind, number]> {
  const share = (files: number) => Math.round((files / item.total) * MARKS);
  const found = item.found.length;
  const missed = Math.max(0, item.fixFiles.length - found);
  const outside = item.total - item.admitted - missed;
  const fix = found > 0 ? Math.max(1, share(found)) : 0;
  const miss = missed > 0 ? Math.max(1, share(missed)) : 0;
  const slice = Math.min(
    MARKS - miss - (outside > 0 ? 1 : 0),
    Math.max(fix + (item.admitted > found ? 1 : 0), share(item.admitted)),
  );
  const runs: Array<[MarkKind, number]> = [
    ["fix", fix],
    ["admitted", slice - fix],
    ["missed", miss],
    ["excluded", MARKS - slice - miss],
  ];
  return runs.filter(([, count]) => count > 0);
}

const repoName = (repo: string) => repo.split("/").pop() ?? repo;
const caseNumber = (index: number) => String(index + 1).padStart(2, "0");
const count = (value: number) => value.toLocaleString("en-US");

function fileRange(rows: Array<{ item: BenchmarkCase }>): string {
  const totals = rows.map(({ item }) => item.total);
  const [low, high] = [Math.min(...totals), Math.max(...totals)];
  return low === high ? `${count(low)} files` : `${count(low)} to ${count(high)} files`;
}

/**
 * Fig. 3: every case in the held-out benchmark, inspectable. One tab per Repo
 * holds its fixes, one row each, drawn as one mark per percent of the Repo's
 * source files. Hovering, focusing or tapping a row opens its details: beside
 * the list on wide screens, under the row on narrow ones. Arrow keys step
 * through the Repos on the tabs and through the cases in the list.
 */
export function CaseBoard({ cases, featured }: { cases: BenchmarkCase[]; featured?: string }) {
  const [selected, setSelected] = useState(() => (cases.find((item) => item.commit === featured) ?? cases[0])?.commit);
  const id = useId();
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
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
  const groupIndex = groups.findIndex(({ repo }) => repo === current.repo);
  const { rows } = groups[groupIndex];

  const chooseRepo = (index: number) => {
    const first = groups[index]?.rows[0];
    if (first) setSelected(first.item.commit);
  };

  const stepTab = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const next = {
      ArrowRight: (index + 1) % groups.length,
      ArrowLeft: (index - 1 + groups.length) % groups.length,
      Home: 0,
      End: groups.length - 1,
    }[event.key];
    if (next === undefined || next === index) return;
    event.preventDefault();
    chooseRepo(next);
    tabs.current[next]?.focus();
  };

  const stepRow = (event: KeyboardEvent<HTMLButtonElement>, position: number) => {
    const next = {
      ArrowDown: position + 1,
      ArrowUp: position - 1,
      Home: 0,
      End: rows.length - 1,
    }[event.key];
    if (next === undefined || next < 0 || next >= rows.length || next === position) return;
    event.preventDefault();
    setSelected(rows[next].item.commit);
    buttons.current[rows[next].index]?.focus();
  };

  return (
    <div className="overflow-hidden rounded-card border border-line-2 bg-surface shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-x-6 border-b border-line px-2 sm:px-3">
        <div role="tablist" aria-label="Repositories" className="flex flex-wrap">
          {groups.map(({ repo }, index) => {
            const isCurrent = index === groupIndex;
            return (
              <button
                key={repo}
                ref={(node) => {
                  tabs.current[index] = node;
                }}
                type="button"
                role="tab"
                id={`${id}-tab-${index}`}
                aria-selected={isCurrent}
                aria-controls={`${id}-panel`}
                tabIndex={isCurrent ? 0 : -1}
                onClick={() => chooseRepo(index)}
                onKeyDown={(event) => stepTab(event, index)}
                className={`h-11 px-2.5 font-mono text-[13px] transition-colors duration-150 sm:px-3 ${
                  isCurrent ? "text-ink shadow-[inset_0_-2px_0_var(--ink)]" : "text-muted hover:text-ink"
                }`}
              >
                {repoName(repo)}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-2.5 py-3 sm:px-3">
          {LEGEND.filter(([kind]) => kind !== "missed" || anyMissed).map(([kind, text]) => (
            <span key={kind} className="inline-flex items-center gap-2 text-[13px] text-ink-2">
              <span aria-hidden="true" className="case-mark w-2.5" data-kind={kind} />
              {text}
            </span>
          ))}
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* The list is a size container: its width sets every row's mark size. */}
        <div
          role="tabpanel"
          id={`${id}-panel`}
          aria-labelledby={`${id}-tab-${groupIndex}`}
          className="case-list min-w-0"
          style={{ "--scale": MARKS } as React.CSSProperties}
        >
          <p className="border-b border-line bg-canvas/50 px-5 py-2 font-mono text-[11px] text-muted sm:px-6">
            <span className="font-medium text-ink-2">{current.repo}</span> · {rows.length} {rows.length === 1 ? "fix" : "fixes"} ·{" "}
            {fileRange(rows)}
          </p>
          <div aria-hidden="true" className="grid grid-cols-[24px_minmax(0,1fr)_auto] gap-x-3 border-b border-line px-5 py-2.5 sm:px-6">
            <span className={label}>#</span>
            <span className={label}>
              Task<span className="hidden sm:inline">, one mark per 1% of files</span>
            </span>
            <span className={label}>Reduction</span>
          </div>

          <ul className="divide-y divide-line">
            {rows.map(({ item, index }, position) => {
              const isSelected = index === currentIndex;
              return (
                <li key={item.commit}>
                  <button
                    ref={(node) => {
                      buttons.current[index] = node;
                    }}
                    type="button"
                    aria-expanded={isSelected}
                    aria-controls={`${id}-spec ${id}-spec-inline`}
                    onClick={() => setSelected(item.commit)}
                    onPointerEnter={(event) => {
                      if (event.pointerType === "mouse") setSelected(item.commit);
                    }}
                    onKeyDown={(event) => stepRow(event, position)}
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
                    <span aria-hidden="true" className="case-strip col-start-1 col-end-4 sm:col-start-2">
                      {markRuns(item).map(([kind, marks]) => (
                        <span key={kind} className="case-run" data-kind={kind} style={{ "--n": marks } as React.CSSProperties} />
                      ))}
                    </span>
                    <span className="sr-only">
                      {`, ${count(item.admitted)} of ${count(item.total)} files admitted, ${item.found.length} of ${item.fixFiles.length} fix files found`}
                    </span>
                  </button>
                  {isSelected && (
                    <div className="border-t border-line bg-canvas/40 px-5 py-5 sm:px-6 lg:hidden">
                      <CaseSpec id={`${id}-spec-inline`} item={item} number={caseNumber(index)} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <aside aria-label="Case details" className="hidden border-l border-line lg:block">
          <div className="sticky top-[84px] p-6">
            <CaseSpec id={`${id}-spec`} item={current} number={caseNumber(currentIndex)} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function CaseSpec({ id, item, number }: { id: string; item: BenchmarkCase; number: string }) {
  const base = `https://github.com/${item.repo}`;
  const found = new Set(item.found);
  const ablation = item.withoutScope;
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
      <p className="mt-2 font-mono text-[11px] leading-5 text-muted [overflow-wrap:anywhere]">
        <span className="sr-only">Commit subject: </span>
        {item.subject}
      </p>

      <dl className="mt-5 grid grid-cols-3 border-y border-line">
        {[
          ["Admitted", <>{count(item.admitted)}<span className="font-normal text-muted"> / {count(item.total)}</span></>],
          ["Reduction", `${item.reductionPct}%`],
          ["Fix found", `${item.found.length} / ${item.fixFiles.length}`],
        ].map(([term, value], index) => (
          <div key={index} className={`py-3 ${index === 0 ? "pr-3" : "border-l border-line pl-3"}`}>
            <dt className="font-mono text-[11px] text-muted">{term}</dt>
            <dd className="mt-1 text-[15px] font-semibold text-ink tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {!item.widened && (
        <p className="mt-3 text-[13px] leading-5 text-ink-2">
          A random Slice of {count(item.admitted)} files would hold each fix file {item.chancePct}% of the time.
        </p>
      )}

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

      {ablation.task !== item.task && (
        <>
          <p className={`mt-5 ${label}`}>Scope word removed</p>
          <p className="mt-2 text-[13px] leading-5 text-ink-2">
            &ldquo;{ablation.task}&rdquo;:{" "}
            {ablation.widened
              ? "Widened to the whole Repo."
              : `${ablation.found.length} of ${item.fixFiles.length} fix files found, ${ablation.reductionPct}% reduction.`}
          </p>
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

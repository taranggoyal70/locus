"use client";

import { useEffect, useRef } from "react";

import { apertureColumns, RECORDED_SLICE } from "@/lib/landing-slice";

const COLUMNS = apertureColumns(RECORDED_SLICE.files);

// A folder with more than 40 files gets a double-width column of ten marks a
// row, so every column stays about the same height and every mark the same
// size.
function marksPerRow(fileCount: number): number {
  return fileCount > 40 ? 10 : 5;
}

const COLUMN_TRACKS = COLUMNS.map(({ files }) => `${marksPerRow(files.length) / 5}fr`).join(" ");
const SLICE_PATHS = new Set<string>(RECORDED_SLICE.slice.map(({ path }) => path));
const ANCHORS = new Set<string>(RECORDED_SLICE.anchors);
const LISTED = 6;

function kind(path: string): "anchor" | "included" | "excluded" {
  if (ANCHORS.has(path)) return "anchor";
  return SLICE_PATHS.has(path) ? "included" : "excluded";
}

function SliceRow({ path, dist }: { path: string; dist: number }) {
  const anchor = ANCHORS.has(path);
  return (
    <li className="flex items-baseline justify-between gap-4 py-2">
      <span className="min-w-0 truncate font-mono text-xs text-ink" title={path}>{path}</span>
      <span className={`shrink-0 font-mono text-[11px] ${anchor ? "text-included" : "text-muted"}`}>
        {anchor ? "Anchor" : `${dist} hop`}
      </span>
    </li>
  );
}

/**
 * The Slice aperture: the whole Repo as a field of files that closes onto the
 * Slice once, when it first comes into view.
 *
 * Server-rendered open (every file in, the way an agent sees a Repo without
 * Locus). The close is a class removal rather than React state so the markup
 * never re-renders, and a <noscript> rule shows the closed figure to readers
 * without JavaScript. Reduced motion closes it at once.
 */
export function Aperture() {
  const figureRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const figure = figureRef.current;
    if (!figure) return;
    const close = () => figure.classList.remove("is-open");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches || !("IntersectionObserver" in window)) {
      close();
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      close();
      observer.disconnect();
    }, { threshold: 0.35 });
    observer.observe(figure);
    const onReducedChange = () => {
      if (!reduced.matches) return;
      close();
      observer.disconnect();
    };
    reduced.addEventListener("change", onReducedChange);
    return () => {
      observer.disconnect();
      reduced.removeEventListener("change", onReducedChange);
    };
  }, []);

  const { slice, files, sliceTokens, totalTokens, widened } = RECORDED_SLICE;

  return (
    <figure
      ref={figureRef}
      className="aperture is-open overflow-hidden rounded-card border border-line-2 bg-surface shadow-panel"
      aria-label={`Recorded run on ${RECORDED_SLICE.repo}: ${slice.length} of ${files.length} files in the Slice`}
    >
      <noscript>
        <style>{".aperture.is-open .aperture-mark::after,.aperture.is-open .aperture-count--repo{opacity:0}.aperture.is-open .aperture-count--slice{opacity:1}"}</style>
      </noscript>

      <div className="flex items-start justify-between gap-6 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <p className="font-mono text-[11px] text-muted">
            Recorded run on{" "}
            <a href={RECORDED_SLICE.repoUrl} className="whitespace-nowrap text-ink-2 underline decoration-line-2 underline-offset-2 hover:decoration-ink">
              {RECORDED_SLICE.repo}
            </a>
          </p>
          <p className="mt-1.5 text-[15px] font-medium leading-snug text-ink">&ldquo;{RECORDED_SLICE.task}&rdquo;</p>
        </div>
        <p className="shrink-0 text-right">
          <span className="grid">
            <span className="aperture-count aperture-count--repo col-start-1 row-start-1 text-2xl font-semibold tracking-[-0.03em] text-ink tabular-nums">
              {files.length}
            </span>
            <span className="aperture-count aperture-count--slice col-start-1 row-start-1 text-2xl font-semibold tracking-[-0.03em] text-ink tabular-nums">
              {slice.length}
              <span className="text-sm font-medium tracking-normal text-muted"> / {files.length}</span>
            </span>
          </span>
          <span className="block font-mono text-[11px] text-muted">files</span>
        </p>
      </div>

      <div className="px-5 py-5" aria-hidden="true">
        <div className="grid items-start gap-2.5 sm:gap-4" style={{ gridTemplateColumns: COLUMN_TRACKS }}>
          {COLUMNS.map((column) => (
            <div
              key={column.label}
              className="grid gap-[3px]"
              style={{ gridTemplateColumns: `repeat(${marksPerRow(column.files.length)}, minmax(0, 1fr))` }}
            >
              {column.files.map((path) => (
                <span key={path} className="aperture-mark" data-kind={kind(path)} />
              ))}
            </div>
          ))}
        </div>
        <div className="mt-2.5 grid gap-2.5 sm:gap-4" style={{ gridTemplateColumns: COLUMN_TRACKS }}>
          {COLUMNS.map((column) => (
            <p key={column.label} className="truncate font-mono text-[11px] text-muted">{column.label}</p>
          ))}
        </div>
      </div>

      <div className="border-t border-line px-5 py-2">
        <ul className="divide-y divide-line">
          {slice.slice(0, LISTED).map((file) => <SliceRow key={file.path} {...file} />)}
        </ul>
        <details className="group">
          <summary className="cursor-pointer list-none py-2 [&::-webkit-details-marker]:hidden text-xs font-medium text-ink-2 hover:text-ink">
            <span className="group-open:hidden">Show {slice.length - LISTED} more files</span>
            <span className="hidden group-open:inline">Show fewer</span>
          </summary>
          <ul className="divide-y divide-line border-t border-line">
            {slice.slice(LISTED).map((file) => <SliceRow key={file.path} {...file} />)}
          </ul>
        </details>
      </div>

      <dl className="grid divide-y divide-line border-t border-line min-[360px]:grid-cols-3 min-[360px]:divide-x min-[360px]:divide-y-0">
        {[
          ["Slice tokens", sliceTokens.toLocaleString("en-US")],
          ["Whole Repo", totalTokens.toLocaleString("en-US")],
          ["Widen", widened ? "Whole Repo" : "Not needed"],
        ].map(([label, value]) => (
          <div key={label} className="flex min-w-0 items-baseline justify-between gap-4 px-5 py-2.5 min-[360px]:block min-[360px]:px-3 min-[360px]:py-3 sm:px-5">
            <dt className="font-mono text-[11px] text-muted">{label}</dt>
            <dd className="text-sm font-semibold min-[360px]:mt-0.5 text-ink tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </figure>
  );
}

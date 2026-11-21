import { Scramble } from "@/components/Reveal";

/**
 * The print grammar of the public pages: a frame of margin rails, full-width
 * hairline rules with a crosshair where they meet a rail, numbered section
 * labels, and figure captions. Reference: docs/design/locus-design-brief.md.
 */

export const frame = "mx-auto max-w-7xl px-5 sm:px-8";

/** Hairlines down both edges of the content column, behind everything. */
export function Rails() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 hidden sm:block">
      <div className="mx-auto h-full max-w-7xl border-x border-line" />
    </div>
  );
}

/** A full-width rule with a crosshair where it crosses each rail. */
export function Rule() {
  return (
    <div aria-hidden="true" className="relative border-t border-line">
      <div className="relative mx-auto hidden max-w-7xl sm:block">
        <span className="crosshair -left-[5px]" />
        <span className="crosshair -right-[5px]" />
      </div>
    </div>
  );
}

/** "01  The Slice": a section number and a label that decodes into view. */
export function SectionLabel({ n, label }: { n: string; label: string }) {
  return (
    <p className="flex gap-3 font-mono text-[11px] font-medium uppercase tracking-[0.08em]">
      <span className="text-ink tabular-nums">{n}</span>
      <Scramble text={label} className="text-muted" />
    </p>
  );
}

/** "Fig. 1  What the figure shows, and where its numbers come from." */
export function FigCaption({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <figcaption className="mt-4 flex gap-3 font-mono text-[11px] leading-5 text-muted">
      <span className="shrink-0 font-medium text-ink">Fig. {n}</span>
      <span>{children}</span>
    </figcaption>
  );
}

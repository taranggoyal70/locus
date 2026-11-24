import { RiseWords, Scramble } from "@/components/Reveal";

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

type HeadingLine = string | { text: string; className: string };

/**
 * A section's opening: a numbered mono label with a status on the right, a
 * hairline under both, then a two-line serif heading whose second line is muted.
 */
export function SectionHead({ n, label, status, lines }: { n: string; label: string; status?: string; lines: [string, string] }) {
  const [first, second]: HeadingLine[] = [lines[0], { text: lines[1], className: "text-muted" }];
  return (
    <div>
      <div className="flex items-baseline justify-between gap-6 border-b border-line pb-3 font-mono text-[11px] font-medium uppercase tracking-[0.12em]">
        <p className="flex gap-3">
          <span className="text-ink tabular-nums">{n}</span>
          <Scramble text={label} className="text-muted" />
        </p>
        {status && <p className="hidden text-right text-muted sm:block">{status}</p>}
      </div>
      <RiseWords
        lines={[first, second]}
        className="mt-8 max-w-4xl font-display text-[clamp(34px,4.6vw,60px)] font-normal leading-[1.02] tracking-[-0.02em] text-ink"
      />
    </div>
  );
}

/**
 * A numbered section of a reference sheet (the signed-in Settings page): the
 * label, serif heading and description in a column on the left at desktop
 * widths, the controls on the right. Separate sections with a `Rule`.
 */
export function SheetSection({
  id,
  n,
  label,
  title,
  description,
  children,
}: {
  id: string;
  n: string;
  label: string;
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={`${frame} grid scroll-mt-20 gap-8 py-12 sm:py-16 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-14`}
    >
      <div className="min-w-0">
        <SectionLabel n={n} label={label} />
        <h2 id={`${id}-title`} className="mt-4 font-display text-[clamp(28px,3vw,36px)] font-normal leading-[1.05] tracking-[-0.015em] text-ink">
          {title}
        </h2>
        <p className="mt-3 max-w-sm text-[15px] leading-6 text-ink-2">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

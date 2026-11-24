/**
 * The control vocabulary of the signed-in pages, matching the public site: one
 * solid ink primary per view, outlined secondaries, 4px corners, a press that
 * scales to 0.97, and hover that changes colour only.
 * Reference: docs/design/locus-design-brief.md ("Shape and surface", "Motion").
 */

const press = "transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100";

export const primaryButton =
  `inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-chip bg-ink px-4 text-[14px] font-medium text-canvas hover:bg-ink/88 ${press}`;

export const secondaryButton =
  `inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-chip border border-line-2 px-4 text-[14px] font-medium text-ink hover:border-ink ${press}`;

/** Removes or cancels something. Crimson is kept for failure, so it only appears on the irreversible action. */
export const dangerButton =
  `inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-chip border border-failed/40 px-4 text-[14px] font-medium text-failed hover:border-failed ${press}`;

/** A row's own action (Delete, Revoke): quiet until it is pointed at. */
export const rowAction =
  "shrink-0 rounded-chip px-2 py-1.5 text-[13px] text-muted transition-colors duration-150 hover:text-failed";

export const textInput =
  "h-10 w-full min-w-0 rounded-chip border border-line-2 bg-surface px-3 text-[14px] text-ink transition-colors duration-150 placeholder:text-muted hover:border-ink/40 focus:border-ink";

export const textLink =
  "font-medium text-ink underline decoration-line-2 underline-offset-[5px] transition-colors duration-150 hover:decoration-ink";

export const monoLabel = "font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted";

/** Mono metadata under a row's title: paths, counts, dates. */
export const monoMeta = "font-mono text-[12px] text-muted tabular-nums";

/** A ruled list: an ink top rule, hairlines between rows. */
export const ruledList = "border-t border-ink";
export const ruledRow = "border-b border-line";

/** "Nov 23, 2026": one date format for every signed-in list. */
export function shortDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

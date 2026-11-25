/**
 * The file field: one square mark per file (or per group of files in a large
 * Repo), in a column per folder. The workspace draws it; the surrounding `.aperture`
 * element owns the open, closed and scanning states. Reference: docs/design/locus-design-brief.md.
 */

export type MarkKind = "anchor" | "included" | "excluded";
export type FieldColumn = { label: string; marks: MarkKind[] };

/** Beyond this many files a mark stands for a group of files, so the field stays drawable. */
export const MAX_MARKS = 600;

/**
 * Groups files into the largest top-level folders (up to `maxColumns`), with
 * every smaller folder and loose file gathered into "other".
 */
export function repoColumns(files: readonly string[], maxColumns = 4): { label: string; files: string[] }[] {
  const byFolder = new Map<string, string[]>();
  for (const file of files) {
    const folder = file.includes("/") ? file.slice(0, file.indexOf("/")) : "other";
    byFolder.set(folder, [...(byFolder.get(folder) ?? []), file]);
  }
  const ranked = [...byFolder.entries()].filter(([folder]) => folder !== "other").sort((a, b) => b[1].length - a[1].length);
  const kept = ranked.slice(0, maxColumns);
  const rest = [...ranked.slice(maxColumns).flatMap(([, list]) => list), ...(byFolder.get("other") ?? [])];
  return [
    ...kept.map(([label, list]) => ({ label, files: [...list].sort() })),
    ...(rest.length ? [{ label: "other", files: rest.sort() }] : []),
  ];
}

/** How many files each mark stands for. */
export function filesPerMark(fileCount: number): number {
  return Math.max(1, Math.ceil(fileCount / MAX_MARKS));
}

/** Turns folder columns into marks; a grouped mark takes the strongest state among its files. */
export function markColumns(
  columns: { label: string; files: readonly string[] }[],
  slice: ReadonlySet<string>,
  anchors: ReadonlySet<string>,
  perMark = 1,
): FieldColumn[] {
  const kind = (path: string): MarkKind => (anchors.has(path) ? "anchor" : slice.has(path) ? "included" : "excluded");
  const rank: Record<MarkKind, number> = { excluded: 0, included: 1, anchor: 2 };
  return columns.map(({ label, files }) => {
    const marks: MarkKind[] = [];
    for (let i = 0; i < files.length; i += perMark) {
      marks.push(files.slice(i, i + perMark).map(kind).reduce((a, b) => (rank[b] > rank[a] ? b : a)));
    }
    return { label, marks };
  });
}

/** Hops from the nearest Anchor for each mark, in the same order as `markColumns`. Null outside the Slice. */
export function markHops(
  columns: { label: string; files: readonly string[] }[],
  hops: ReadonlyMap<string, number>,
  perMark = 1,
): (number | null)[][] {
  return columns.map(({ files }) => {
    const marks: (number | null)[] = [];
    for (let i = 0; i < files.length; i += perMark) {
      const found = files.slice(i, i + perMark).flatMap((path) => hops.get(path) ?? []);
      marks.push(found.length ? Math.min(...found) : null);
    }
    return marks;
  });
}

// A column with more than 40 marks widens instead of growing taller, so every
// column stays about the same height and every mark the same size.
function marksPerRow(count: number): number {
  return count > 40 ? Math.max(10, Math.ceil(count / 8)) : 5;
}

export function FileField({ columns, hops }: { columns: FieldColumn[]; hops?: (number | null)[][] }) {
  const tracks = columns.map(({ marks }) => `${marksPerRow(marks.length) / 5}fr`).join(" ");
  let index = 0;
  return (
    <div aria-hidden="true">
      <div className="grid items-start gap-2.5 sm:gap-4" style={{ gridTemplateColumns: tracks }}>
        {columns.map((column, c) => (
          <div
            key={column.label}
            className="grid gap-[3px]"
            style={{ gridTemplateColumns: `repeat(${marksPerRow(column.marks.length)}, minmax(0, 1fr))` }}
          >
            {column.marks.map((kind, i) => (
              <span key={i} className="aperture-mark" data-kind={kind} style={{ "--i": index++, "--hop": hops?.[c]?.[i] ?? undefined } as React.CSSProperties} />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2.5 grid gap-2.5 sm:gap-4" style={{ gridTemplateColumns: tracks }}>
        {columns.map((column) => (
          <p key={column.label} className="truncate font-mono text-[11px] text-muted" title={column.label}>{column.label}</p>
        ))}
      </div>
    </div>
  );
}

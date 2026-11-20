/**
 * The footer's signature: a Repo drawn as file marks with one Slice in teal,
 * in the same language as the product's own file field. Decorative, and
 * deterministic, so server and client render the same marks.
 */
const COLUMNS = 112;
const ROWS = 7;
const CELL = 10;
const GAP = 4;

function noise(index: number): number {
  const value = Math.sin(index * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

type Mark = "slice" | "anchor" | "repo" | "faint";

function markAt(column: number, row: number): Mark {
  const index = row * COLUMNS + column;
  // An irregular Slice a little right of centre, ragged at its edges.
  const dx = (column - 70) / 9;
  const dy = (row - 3) / 3.2;
  const distance = dx * dx + dy * dy + noise(index) * 0.55;
  if (distance < 0.55 && noise(index + 7) > 0.55) return "anchor";
  if (distance < 1) return "slice";
  return noise(index + 3) > 0.62 ? "faint" : "repo";
}

export function FooterField({ className = "" }: { className?: string }) {
  const width = COLUMNS * (CELL + GAP) - GAP;
  const height = ROWS * (CELL + GAP) - GAP;
  const marks: Array<{ x: number; y: number; kind: Mark }> = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 0; column < COLUMNS; column += 1) {
      marks.push({ x: column * (CELL + GAP), y: row * (CELL + GAP), kind: markAt(column, row) });
    }
  }

  return (
    <div aria-hidden="true" className={className}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid slice"
        className="block h-[66px] w-full sm:h-[94px]"
      >
        {marks.map(({ x, y, kind }) =>
          kind === "anchor" ? (
            <rect key={`${x}-${y}`} x={x + 1} y={y + 1} width={CELL - 2} height={CELL - 2} rx={1.5} fill="none" stroke="var(--included)" strokeWidth={2} />
          ) : (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width={CELL}
              height={CELL}
              rx={2}
              fill={kind === "slice" ? "var(--included)" : "var(--excluded)"}
              opacity={kind === "faint" ? 0.45 : 1}
            />
          ),
        )}
      </svg>
    </div>
  );
}

/**
 * The footer's signature: a Repo drawn as file marks, with the name set in them.
 * The marks in the bowl of the O are the Slice, the one place it is orange.
 * Decorative, and deterministic, so server and client render the same marks.
 */
const COLUMNS = 112;
const ROWS = 15;
const CELL = 10;
const GAP = 4;
const PITCH = CELL + GAP;

/** The field's grid, for the footer scene that draws over it. */
export const FIELD = {
  columns: COLUMNS,
  rows: ROWS,
  cell: CELL,
  pitch: PITCH,
  width: COLUMNS * PITCH - GAP,
  height: ROWS * PITCH - GAP,
} as const;

// Nine rows, two-mark stems: 34 columns, narrow enough to show whole on a phone.
const LETTERS: string[][] = [
  ["##....", "##....", "##....", "##....", "##....", "##....", "##....", "######", "######"],
  [".####.", "######", "##..##", "##..##", "##..##", "##..##", "##..##", "######", ".####."],
  [".####.", "######", "##..##", "##....", "##....", "##....", "##..##", "######", ".####."],
  ["##..##", "##..##", "##..##", "##..##", "##..##", "##..##", "##..##", "######", ".####."],
  [".#####", "######", "##....", "#####.", ".#####", "....##", "....##", "######", "#####."],
];
const LEFT = (COLUMNS - 34) / 2;
const TOP = 3;

/** The column and row the footer's first wave starts from: the Slice in the O. */
export const ORIGIN = { col: LEFT + 7 + 2.5, row: TOP + 4 } as const;

function noise(index: number): number {
  const value = Math.sin(index * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

// One short path segment per mark. The round-joined stroke gives it its corners.
const mark = (column: number, row: number) => `M${column * PITCH + 2} ${row * PITCH + 2}h6v6h-6z`;

const wordColumns: string[] = [];
const taken = new Set<string>();
LETTERS.forEach((letter, index) => {
  for (let c = 0; c < 6; c += 1) {
    const column = LEFT + index * 7 + c;
    let path = "";
    letter.forEach((line, r) => {
      if (line[c] !== "#") return;
      path += mark(column, TOP + r);
      taken.add(`${column},${TOP + r}`);
    });
    wordColumns.push(path);
  }
});

const slice: Array<[number, number]> = [];
for (let r = 2; r < 7; r += 1) for (let c = 2; c < 4; c += 1) slice.push([LEFT + 7 + c, TOP + r]);
for (const [c, r] of slice) taken.add(`${c},${r}`);

let field = "";
let faint = "";
for (let row = 0; row < ROWS; row += 1) {
  for (let column = 0; column < COLUMNS; column += 1) {
    if (taken.has(`${column},${row}`)) continue;
    if (noise(row * COLUMNS + column + 3) > 0.62) faint += mark(column, row);
    else field += mark(column, row);
  }
}

export function FooterField({ className = "" }: { className?: string }) {
  return (
    <div aria-hidden="true" className={className}>
      <svg
        viewBox={`0 0 ${FIELD.width} ${FIELD.height}`}
        preserveAspectRatio="xMidYMid slice"
        className="footer-field block h-[126px] w-full max-[359px]:h-[108px] sm:h-auto"
        strokeLinejoin="round"
        strokeWidth={4}
      >
        <path d={field} fill="var(--excluded)" stroke="var(--excluded)" />
        <path d={faint} fill="var(--excluded)" stroke="var(--excluded)" opacity={0.45} />
        {wordColumns.map((path, index) => (
          <path key={index} d={path} className="footer-word" style={{ "--i": index } as React.CSSProperties} />
        ))}
        {slice.map(([column, row], index) =>
          row === TOP + 4 ? (
            <rect key={index} x={column * PITCH + 1} y={row * PITCH + 1} width={CELL - 2} height={CELL - 2} rx={1.5} fill="none" stroke="var(--included)" strokeWidth={2} />
          ) : (
            <path key={index} d={mark(column, row)} fill="var(--included)" stroke="var(--included)" />
          ),
        )}
      </svg>
    </div>
  );
}

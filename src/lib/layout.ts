import type { Graph } from "@/lib/types";

// Pure layout for the dependency graph: nodes in columns by top-level dir,
// ordered by dependency flow (routes → components → hooks → libs). Kept out of
// the React component so its interface (positions + dimensions) is the test
// surface — you can assert on the geometry without rendering anything.

export const NODE_W = 168;
export const NODE_H = 26;
const COL_W = 220;
const ROW_H = 38;
const PAD_X = 20;
const PAD_Y = 28;
const COL_ORDER = ["app", "components", "hooks", "lib"];

export type Pos = { x: number; y: number };
export type GraphLayout = {
  pos: Record<string, Pos>; // keyed by node.rel
  W: number;
  H: number;
  cols: string[];
  colX: number[]; // x of each column, parallel to cols
};

export function layoutGraph(graph: Graph): GraphLayout {
  const cols = [...new Set(graph.nodes.map((n) => n.dir))].sort((a, b) => {
    const ia = COL_ORDER.indexOf(a), ib = COL_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  const byCol: Record<string, typeof graph.nodes> = {};
  for (const c of cols) {
    byCol[c] = graph.nodes
      .filter((n) => n.dir === c)
      .sort((a, b) => Number(b.isSurface) - Number(a.isSurface) || a.rel.localeCompare(b.rel));
  }
  const maxRows = Math.max(1, ...cols.map((c) => byCol[c].length));
  const H = PAD_Y * 2 + maxRows * ROW_H;
  const W = PAD_X * 2 + cols.length * COL_W;
  const pos: Record<string, Pos> = {};
  cols.forEach((c, ci) => {
    const list = byCol[c];
    const offset = (maxRows - list.length) / 2;
    list.forEach((n, ri) => {
      pos[n.rel] = { x: PAD_X + ci * COL_W, y: PAD_Y + (offset + ri) * ROW_H };
    });
  });
  const colX = cols.map((_, ci) => PAD_X + ci * COL_W);
  return { pos, W, H, cols, colX };
}

/** Bezier edge between two laid-out nodes (right edge → left edge). */
export function edgePath(from: Pos, to: Pos): string {
  const x1 = from.x + NODE_W, y1 = from.y + NODE_H / 2;
  const x2 = to.x, y2 = to.y + NODE_H / 2;
  const dx = Math.max(40, Math.abs(x2 - x1) / 2);
  return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
}

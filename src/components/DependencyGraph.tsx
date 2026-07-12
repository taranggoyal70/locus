"use client";

import { useMemo } from "react";

import type { Graph, LocateResult } from "@/lib/types";

const COL_ORDER = ["app", "components", "hooks", "lib"];
const NODE_W = 168;
const NODE_H = 26;
const COL_W = 220;
const ROW_H = 38;
const PAD_X = 20;
const PAD_Y = 28;

type Pos = { x: number; y: number };

function basename(rel: string): string {
  return rel.split("/").slice(-1)[0];
}

export function DependencyGraph({
  graph,
  result,
  selected,
  onSelect,
}: {
  graph: Graph;
  result: LocateResult | null;
  selected: string | null;
  onSelect: (rel: string) => void;
}) {
  const layout = useMemo(() => {
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
    const maxRows = Math.max(...cols.map((c) => byCol[c].length));
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
    return { pos, W, H, cols };
  }, [graph]);

  const sliceSet = useMemo(
    () => new Set(result && !result.widened ? result.slice.map((s) => s.rel) : []),
    [result],
  );
  const anchorSet = useMemo(() => new Set(result?.anchors ?? []), [result]);
  const recentSet = useMemo(
    () => new Set(graph.nodes.filter((n) => result?.slice.find((s) => s.rel === n.rel && s.recent)).map((n) => n.rel)),
    [graph, result],
  );
  const localized = !!result && !result.widened;

  function nodeState(rel: string): "anchor" | "slice" | "excluded" | "neutral" {
    if (!localized) return "neutral";
    if (anchorSet.has(rel)) return "anchor";
    if (sliceSet.has(rel)) return "slice";
    return "excluded";
  }

  const edgePath = (from: Pos, to: Pos) => {
    const x1 = from.x + NODE_W, y1 = from.y + NODE_H / 2;
    const x2 = to.x, y2 = to.y + NODE_H / 2;
    const dx = Math.max(40, Math.abs(x2 - x1) / 2);
    return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
  };

  return (
    <div className="w-full overflow-auto rounded-xl border border-line bg-ink/50">
      <svg viewBox={`0 0 ${layout.W} ${layout.H}`} className="w-full" style={{ minWidth: layout.W }}>
        {/* column headers */}
        {layout.cols.map((c, ci) => (
          <text
            key={c}
            x={PAD_X + ci * COL_W}
            y={16}
            className="fill-[var(--muted)] font-mono text-[11px] uppercase tracking-wider"
          >
            {c}/
          </text>
        ))}

        {/* edges */}
        {graph.edges.map((e, i) => {
          const fr = graph.byPath[e.from]?.rel, tr = graph.byPath[e.to]?.rel;
          if (!fr || !tr || !layout.pos[fr] || !layout.pos[tr]) return null;
          const both = sliceSet.has(fr) && sliceSet.has(tr);
          const op = !localized ? 0.18 : both ? 0.55 : 0.05;
          const stroke = localized && both ? "var(--accent)" : "var(--muted)";
          return (
            <path
              key={i}
              d={edgePath(layout.pos[fr], layout.pos[tr])}
              fill="none"
              stroke={stroke}
              strokeWidth={both ? 1.4 : 1}
              opacity={op}
              className="transition-all duration-500"
            />
          );
        })}

        {/* nodes */}
        {graph.nodes.map((n) => {
          const p = layout.pos[n.rel];
          if (!p) return null;
          const st = nodeState(n.rel);
          const isSel = selected === n.rel;
          const fill =
            st === "anchor" ? "var(--accent)" :
            st === "slice" ? "rgba(163,230,53,0.12)" :
            st === "excluded" ? "rgba(58,68,74,0.25)" : "rgba(160,190,200,0.06)";
          const stroke =
            st === "anchor" ? "var(--accent)" :
            st === "slice" ? "var(--accent)" :
            st === "excluded" ? "var(--excluded)" : "var(--line-strong)";
          const textFill =
            st === "anchor" ? "var(--ink)" :
            st === "excluded" ? "var(--excluded)" : "var(--paper)";
          const opacity = st === "excluded" ? 0.5 : 1;
          return (
            <g
              key={n.rel}
              transform={`translate(${p.x},${p.y})`}
              className="cursor-pointer transition-all duration-500"
              opacity={opacity}
              onClick={() => onSelect(n.rel)}
            >
              <title>{`${n.rel} · ${n.tokens} tok`}</title>
              <rect
                width={NODE_W}
                height={NODE_H}
                rx={6}
                fill={fill}
                stroke={isSel ? "var(--paper)" : stroke}
                strokeWidth={isSel ? 2 : st === "anchor" ? 2 : 1}
                className="transition-all duration-500"
              />
              {st === "anchor" && (
                <rect width={NODE_W} height={NODE_H} rx={6} fill="none" stroke="var(--accent)" strokeWidth={1} opacity={0.4}>
                  <animate attributeName="opacity" values="0.4;0.05;0.4" dur="2.2s" repeatCount="indefinite" />
                </rect>
              )}
              <text
                x={9}
                y={NODE_H / 2 + 3.5}
                className="font-mono text-[11px] transition-all duration-500"
                fill={textFill}
                fontWeight={st === "anchor" ? 600 : 400}
              >
                {basename(n.rel)}
              </text>
              {recentSet.has(n.rel) && (
                <circle cx={NODE_W - 8} cy={8} r={3.5} fill="var(--recent)">
                  <title>recently changed — likely relevant</title>
                </circle>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

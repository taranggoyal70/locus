"use client";

import { useMemo } from "react";

import { edgePath, layoutGraph, NODE_H, NODE_W } from "@/lib/layout";
import type { Graph, LocateResult } from "@/lib/types";

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
  const layout = useMemo(() => layoutGraph(graph), [graph]);

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

  return (
    <div className="w-full overflow-auto rounded-xl border border-line bg-ink/50">
      <svg viewBox={`0 0 ${layout.W} ${layout.H}`} className="w-full" style={{ minWidth: layout.W }}>
        {/* column headers */}
        {layout.cols.map((c, ci) => (
          <text
            key={c}
            x={layout.colX[ci]}
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

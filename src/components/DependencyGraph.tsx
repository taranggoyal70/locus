"use client";

import { useMemo } from "react";

import { edgePath, layoutGraph, NODE_H, NODE_W } from "@/lib/layout";
import type { Graph, LocateResult } from "@/lib/types";

// Next.js "role" filenames repeat all over a repo (14× page.tsx in taxonomy),
// so a bare basename is useless as a label — qualify these with their parent.
const GENERIC = new Set([
  "page.tsx", "page.ts", "layout.tsx", "layout.ts", "route.ts", "route.tsx",
  "loading.tsx", "error.tsx", "not-found.tsx", "default.tsx", "template.tsx", "index.ts", "index.tsx",
]);

function label(rel: string): string {
  const parts = rel.split("/");
  const base = parts[parts.length - 1];
  if (GENERIC.has(base) && parts.length >= 2) return parts.slice(-2).join("/");
  return base;
}

const OVERVIEW_CAP = 48; // don't render a wall when there's no localization yet

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
  const localized = !!result && !result.widened;
  const sliceSet = useMemo(
    () => new Set(localized ? result!.slice.map((s) => s.rel) : []),
    [localized, result],
  );
  const anchorSet = useMemo(() => new Set(result?.anchors ?? []), [result]);
  const recentSet = useMemo(
    () => new Set(result?.slice.filter((s) => s.recent).map((s) => s.rel) ?? []),
    [result],
  );

  // Foreground the Slice. When there's no confident localization, show a capped
  // overview instead of the whole tree (which is a wall on real repos).
  const visibleNodes = useMemo(() => {
    if (localized) return graph.nodes.filter((n) => sliceSet.has(n.rel));
    return graph.nodes.slice(0, OVERVIEW_CAP);
  }, [graph, localized, sliceSet]);

  const visibleRels = useMemo(() => new Set(visibleNodes.map((n) => n.rel)), [visibleNodes]);
  const hidden = graph.nodes.length - visibleNodes.length;
  const layout = useMemo(() => layoutGraph(visibleNodes), [visibleNodes]);

  const visibleEdges = useMemo(
    () =>
      graph.edges.filter((e) => {
        const fr = graph.byPath[e.from]?.rel, tr = graph.byPath[e.to]?.rel;
        return fr && tr && visibleRels.has(fr) && visibleRels.has(tr);
      }),
    [graph, visibleRels],
  );

  function nodeState(rel: string): "anchor" | "slice" | "neutral" {
    if (anchorSet.has(rel)) return "anchor";
    if (localized && sliceSet.has(rel)) return "slice";
    return "neutral";
  }

  return (
    <div className="w-full overflow-auto rounded-xl border border-line bg-ink/50">
      <div className="flex items-center justify-between px-4 pt-3 text-[11px] text-muted">
        <span>
          {localized
            ? `Slice · ${visibleNodes.length} file${visibleNodes.length === 1 ? "" : "s"} the agent needs`
            : `Overview · ${graph.nodes.length} files (describe a task to localize)`}
        </span>
        {hidden > 0 && (
          <span className="rounded-full border border-line-strong px-2 py-0.5">
            {hidden} {localized ? "excluded" : "more"} — not shown
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${layout.W} ${layout.H}`} className="w-full" style={{ minWidth: Math.min(layout.W, 900) }}>
        {layout.cols.map((c, ci) => (
          <text key={c} x={layout.colX[ci]} y={16} className="fill-[var(--muted)] font-mono text-[11px] uppercase tracking-wider">
            {c}/
          </text>
        ))}

        {visibleEdges.map((e, i) => {
          const fr = graph.byPath[e.from].rel, tr = graph.byPath[e.to].rel;
          if (!layout.pos[fr] || !layout.pos[tr]) return null;
          return (
            <path
              key={i}
              d={edgePath(layout.pos[fr], layout.pos[tr])}
              fill="none"
              stroke={localized ? "var(--accent)" : "var(--muted)"}
              strokeWidth={1.2}
              opacity={localized ? 0.5 : 0.18}
              className="transition-all duration-500"
            />
          );
        })}

        {visibleNodes.map((n) => {
          const p = layout.pos[n.rel];
          if (!p) return null;
          const st = nodeState(n.rel);
          const isSel = selected === n.rel;
          const fill =
            st === "anchor" ? "var(--accent)" :
            st === "slice" ? "rgba(163,230,53,0.12)" : "rgba(160,190,200,0.06)";
          const stroke =
            st === "anchor" ? "var(--accent)" :
            st === "slice" ? "var(--accent)" : "var(--line-strong)";
          const textFill = st === "anchor" ? "var(--ink)" : "var(--paper)";
          return (
            <g
              key={n.rel}
              transform={`translate(${p.x},${p.y})`}
              className="cursor-pointer transition-all duration-500"
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
              <text x={9} y={NODE_H / 2 + 3.5} className="font-mono text-[11px]" fill={textFill} fontWeight={st === "anchor" ? 600 : 400}>
                {label(n.rel)}
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

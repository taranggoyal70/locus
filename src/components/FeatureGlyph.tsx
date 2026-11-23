"use client";

import { useRef, type CSSProperties } from "react";

import { useEnterView } from "@/components/Reveal";

/**
 * The feature row's glyphs: a nine by seven field of file marks acting out one
 * step of Localize. The server draws the finished state; a glyph that starts
 * offscreen plays when it scrolls into view, and again when pointed at. With
 * reduced motion it stays finished (globals.css, "Feature glyphs").
 */
export type GlyphKind = "localize" | "follow" | "explain" | "measure" | "handoff";

type Tone = "rest" | "ink" | "signal" | "anchor" | "none";
type Mark = { c: number; r: number; from: Tone; to: Tone; delay?: number; move?: [number, number]; scan?: boolean };

const COLS = 9;
const ROWS = 7;
const CELL = 10;
const SIZE = 8;

const fill: Record<Tone, string> = {
  rest: "var(--excluded)",
  ink: "var(--ink-2)",
  signal: "var(--included)",
  anchor: "var(--included)",
  none: "transparent",
};

const key = (c: number, r: number) => `${c},${r}`;
const noise = (i: number) => {
  const value = Math.sin(i * 12.9898) * 43758.5453;
  return value - Math.floor(value);
};

function field(overrides: Map<string, Omit<Mark, "c" | "r">>, base: Omit<Mark, "c" | "r">, skip = new Set<string>()): Mark[] {
  const marks: Mark[] = [];
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      if (skip.has(key(c, r))) continue;
      marks.push({ c, r, ...(overrides.get(key(c, r)) ?? base) });
    }
  }
  return marks;
}

function marksFor(kind: GlyphKind): { marks: Mark[]; box?: boolean } {
  switch (kind) {
    case "localize": {
      const anchors = [[5, 2], [6, 2], [6, 3]];
      const overrides = new Map(anchors.map(([c, r], i) => [key(c, r), { from: "rest" as Tone, to: "anchor" as Tone, delay: 760 + i * 140, scan: true }]));
      return { marks: field(overrides, { from: "rest", to: "rest", scan: true }) };
    }
    case "follow": {
      const overrides = new Map<string, Omit<Mark, "c" | "r">>([[key(4, 3), { from: "anchor", to: "anchor" }]]);
      [[3, 3], [5, 3], [4, 2], [5, 2], [4, 4]].forEach(([c, r], i) => overrides.set(key(c, r), { from: "rest", to: "signal", delay: 220 + i * 70 }));
      [[2, 3], [6, 3], [6, 2], [3, 1], [5, 5], [2, 4], [6, 1]].forEach(([c, r], i) => overrides.set(key(c, r), { from: "rest", to: "signal", delay: 760 + i * 70 }));
      return { marks: field(overrides, { from: "rest", to: "rest" }) };
    }
    case "explain": {
      const overrides = new Map<string, Omit<Mark, "c" | "r">>();
      [[1, 5, "anchor"], [3, 3, "signal"], [5, 6, "signal"]].forEach(([r, length, tone], row) => {
        const start = 120 + row * 320;
        overrides.set(key(0, r as number), { from: "rest", to: tone as Tone, delay: start });
        for (let c = 2; c < 2 + (length as number); c += 1) overrides.set(key(c, r as number), { from: "rest", to: "ink", delay: start + 80 + (c - 2) * 45 });
      });
      return { marks: field(overrides, { from: "rest", to: "none" }) };
    }
    case "measure": {
      const slice = new Set([key(1, 4), key(2, 4), key(1, 5), key(2, 5), key(3, 5), key(2, 3), key(3, 4)]);
      const marks = field(new Map(), { from: "ink", to: "rest" }).map((mark, i) =>
        slice.has(key(mark.c, mark.r))
          ? { ...mark, to: "signal" as Tone, delay: 900 }
          : { ...mark, delay: 120 + Math.round(noise(i) * 700) },
      );
      return { marks };
    }
    case "handoff": {
      const moving = [[0, 2], [1, 2], [0, 3], [1, 3], [0, 4], [1, 4]];
      const box = new Set<string>();
      for (let c = 6; c < 9; c += 1) for (let r = 1; r < 6; r += 1) box.add(key(c, r));
      const skip = new Set([...box, ...moving.map(([c, r]) => key(c, r))]);
      const marks = field(new Map(), { from: "rest", to: "rest" }, skip).map((mark) => ({ ...mark, from: "none" as Tone, to: "none" as Tone }));
      moving.forEach(([c, r], i) => marks.push({ c, r, from: "signal", to: "signal", delay: 200 + i * 110, move: [6 * CELL, 0] }));
      return { marks, box: true };
    }
  }
}

const armGlyph = (element: HTMLElement) => element.classList.add("is-armed");
const enterGlyph = (element: HTMLElement) => {
  element.classList.remove("is-armed");
  element.classList.remove("is-playing");
  void element.getBoundingClientRect();
  element.classList.add("is-playing");
};

export function FeatureGlyph({ kind }: { kind: GlyphKind }) {
  const ref = useRef<HTMLDivElement>(null);
  useEnterView(ref, armGlyph, enterGlyph, 0.6);
  const { marks, box } = marksFor(kind);

  const replay = () => {
    const element = ref.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    armGlyph(element);
    void element.getBoundingClientRect();
    enterGlyph(element);
  };

  return (
    <div ref={ref} className="glyph" onPointerEnter={replay} aria-hidden="true">
      <svg viewBox={`0 0 ${COLS * CELL - (CELL - SIZE)} ${ROWS * CELL - (CELL - SIZE)}`} className="block h-auto w-[88px]">
        {box && <rect className="glyph-box" x={6 * CELL - 2} y={CELL - 2} width={3 * CELL + 2} height={5 * CELL + 2} rx={2} />}
        {marks.map((mark) => (
          <g
            key={`${mark.c}-${mark.r}`}
            className={`glyph-cell ${mark.scan ? "glyph-scan" : ""}`}
            style={{
              "--from": fill[mark.from],
              "--to": fill[mark.to],
              "--d": `${mark.delay ?? 0}ms`,
              "--c": mark.c,
              "--move": mark.move ? `translate(${mark.move[0]}px, ${mark.move[1]}px)` : "none",
            } as CSSProperties}
          >
            <rect className="glyph-mark" x={mark.c * CELL} y={mark.r * CELL} width={SIZE} height={SIZE} rx={1.5} />
            {mark.to === "anchor" && <rect className="glyph-hole" x={mark.c * CELL + 2.5} y={mark.r * CELL + 2.5} width={3} height={3} rx={0.5} />}
          </g>
        ))}
      </svg>
    </div>
  );
}

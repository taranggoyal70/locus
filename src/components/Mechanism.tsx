"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { useEnterView } from "@/components/Reveal";
import { RECORDED_SLICE } from "@/lib/landing-slice";

const { task, slice, anchors, edges, sliceTokens, totalTokens, files } = RECORDED_SLICE;

const DIST = new Map<string, number>(slice.map(({ path, dist }) => [path, dist]));
const HOPS = [0, 1, 2].map((hop) => slice.filter(({ dist }) => dist === hop).map(({ path }) => path));
const HOP_TITLES = ["Anchors", "1 hop", "2 hops"];

/** Imports that step the Closure out by exactly one hop: the lines Fig. 2 draws. */
export const HOP_EDGES = edges.filter(([from, to]) => DIST.get(to) === (DIST.get(from) ?? 0) + 1);

const STOP_WORDS = new Set(["the", "and", "for", "with"]);

/** Task words that appear in an Anchor's path, the visible part of why it matched. */
export const MATCHED_TERMS = task
  .split(" ")
  .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
  .filter((word) => anchors.some((path) => path.toLowerCase().includes(word)));

const TERM_RE = new RegExp(`(${MATCHED_TERMS.join("|")})`, "gi");

function Highlighted({ text }: { text: string }) {
  return text.split(TERM_RE).map((part, index) =>
    index % 2 === 1 ? <mark key={index} className="mech-term">{part}</mark> : part,
  );
}

const SHARE = sliceTokens / totalTokens;
const BEATS = ["b1", "b2", "b3", "b4", "b5"];
const BEAT_AT = [0, 1300, 2100, 2900, 3700];

function formatTokens(value: number) {
  return Math.round(value).toLocaleString("en-US");
}

/** The pending beats of a figure's current play, and which play is current. */
const plays = new WeakMap<HTMLElement, { run: number; timers: number[] }>();

function stopMechanism(element: HTMLElement) {
  plays.get(element)?.timers.forEach((timer) => window.clearTimeout(timer));
}

function armMechanism(element: HTMLElement) {
  element.classList.remove(...BEATS);
  const count = element.querySelector<HTMLElement>(".mech-count");
  if (count) count.textContent = formatTokens(totalTokens);
}

function enterMechanism(element: HTMLElement) {
  stopMechanism(element);
  const run = (plays.get(element)?.run ?? 0) + 1;
  const timers = BEATS.map((beat, index) => window.setTimeout(() => element.classList.add(beat), BEAT_AT[index]));
  timers.push(window.setTimeout(() => {
    const count = element.querySelector<HTMLElement>(".mech-count");
    if (!count) return;
    const start = performance.now();
    const tick = (now: number) => {
      // A replay started since: its own count takes over.
      if (plays.get(element)?.run !== run) return;
      const t = Math.min(1, Math.max(0, (now - start) / 900));
      count.textContent = formatTokens(totalTokens - (totalTokens - sliceTokens) * (1 - (1 - t) ** 3));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, BEAT_AT[4]));
  plays.set(element, { run, timers });
}

/** Plays the figure again from the start. Arming is instant (no transitions), so it never plays backwards. */
function replayMechanism(element: HTMLElement) {
  stopMechanism(element);
  armMechanism(element);
  void element.offsetWidth; // commit the armed state, so the first beat transitions from it
  enterMechanism(element);
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener?.("change", onChange);
  return () => query.removeEventListener?.("change", onChange);
}

/** Replay is offered only where the figure animates: never on the server, never with reduced motion. */
function useCanReplay() {
  return useSyncExternalStore(subscribeMotion, () => !window.matchMedia(REDUCED_MOTION).matches, () => false);
}

type Line = { d: string; hop: number };

/** Measures each drawn import from the live layout, so the lines follow any reflow. */
function useEdgeLines(graphRef: React.RefObject<HTMLDivElement | null>) {
  const [lines, setLines] = useState<Line[]>([]);
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    const measure = () => {
      const origin = graph.getBoundingClientRect();
      const box = (path: string) =>
        graph.querySelector<HTMLElement>(`[data-node="${CSS.escape(path)}"] .mech-path`)?.getBoundingClientRect();
      setLines(HOP_EDGES.flatMap(([from, to]) => {
        const a = box(from);
        const b = box(to);
        if (!a || !b || a.width === 0) return [];
        const x1 = a.right - origin.left + 8;
        const y1 = a.top + a.height / 2 - origin.top;
        const x2 = b.left - origin.left - 22;
        const y2 = b.top + b.height / 2 - origin.top;
        const bend = (x2 - x1) / 2;
        return [{ d: `M${x1} ${y1} C${x1 + bend} ${y1} ${x2 - bend} ${y2} ${x2} ${y2}`, hop: DIST.get(to) ?? 1 }];
      }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(graph);
    return () => observer.disconnect();
  }, [graphRef]);
  return lines;
}

/**
 * Fig. 2 on the Evidence page: how Locus built the Slice the home page demo
 * plays, played once when it scrolls into view. Server-rendered complete; the beats are classes added on a timer, so
 * reduced motion and readers without JavaScript see the finished figure.
 */
export function Mechanism() {
  const rootRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<HTMLDivElement>(null);
  useEnterView(rootRef, armMechanism, enterMechanism, 0.35);
  const lines = useEdgeLines(graphRef);
  const canReplay = useCanReplay();

  useEffect(() => {
    const element = rootRef.current;
    return () => {
      if (element) stopMechanism(element);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`mech ${BEATS.join(" ")} overflow-hidden rounded-card border border-line-2 bg-surface shadow-panel`}
      style={{ "--share": SHARE } as React.CSSProperties}
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-5 sm:px-6">
        <div className="min-w-0">
          <p className="font-mono text-[11px] text-muted">Task</p>
          <p className="mech-task mt-1.5 font-mono text-[15px] text-ink" style={{ "--chars": task.length } as React.CSSProperties}>
            <Highlighted text={task} />
          </p>
        </div>
        {canReplay && (
          <button
            type="button"
            aria-label="Replay Fig. 2"
            onClick={() => rootRef.current && replayMechanism(rootRef.current)}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-chip border border-line-2 px-2.5 font-mono text-[11px] text-ink-2 transition-[border-color,color,transform] duration-150 hover:border-ink hover:text-ink active:scale-[0.97]"
          >
            <span aria-hidden="true" className="text-[13px] leading-none">↺</span>
            Replay
          </button>
        )}
      </div>

      <div ref={graphRef} className="relative grid gap-8 px-5 py-6 sm:px-6 lg:grid-cols-[auto_auto_auto] lg:justify-between lg:gap-x-16 lg:py-8">
        <svg aria-hidden="true" className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block">
          {lines.map(({ d, hop }, index) => (
            <path key={index} d={d} pathLength={1} className="mech-edge" data-hop={hop} style={{ "--i": index } as React.CSSProperties} />
          ))}
        </svg>
        {HOPS.map((paths, hop) => (
          <div key={hop} className="mech-col min-w-0 lg:flex lg:flex-col lg:justify-center" data-hop={hop}>
            <p className="font-mono text-[11px] text-muted">{HOP_TITLES[hop]}</p>
            <ul className="mt-2 space-y-1.5">
              {paths.map((path, index) => (
                <li
                  key={path}
                  data-node={path}
                  className="mech-node flex min-w-0 items-center gap-2.5"
                  style={{ "--i": index } as React.CSSProperties}
                >
                  <span className="aperture-mark w-3 shrink-0" data-kind={hop === 0 ? "anchor" : "included"} />
                  <span className="mech-path truncate font-mono text-xs text-ink" title={path}>
                    {hop === 0 ? <Highlighted text={path} /> : path}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="grid gap-3 border-t border-line px-5 py-4 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-6 sm:px-6">
        <p className="font-mono text-[11px] text-muted">Context sent to the agent</p>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div className="mech-bar h-full origin-left rounded-full" />
        </div>
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm text-muted">
          <span className="mech-count text-lg font-semibold tracking-[-0.02em] text-ink tabular-nums">{formatTokens(sliceTokens)}</span>
          <span className="tabular-nums">of {formatTokens(totalTokens)} tokens</span>
          <span className="mech-outside basis-full font-mono text-[11px] sm:basis-auto">
            <span className="hidden sm:inline">· </span>{files.length - slice.length} files held outside
          </span>
        </p>
      </div>
    </div>
  );
}

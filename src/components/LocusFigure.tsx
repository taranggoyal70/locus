"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

import { RollNumber, useEnterView } from "@/components/Reveal";
import { FILES, FOLDERS, GRID, LOCALIZATIONS, point, RIM, rimAngle, RINGS } from "@/lib/locus-layout";

/**
 * A Repo drawn as a locus: every file a mark, at its distance in imports from
 * the task. The four tasks are recorded localizations (landing-orbits.json), so
 * every ring, line and count is the engine's own output.
 *
 * The server draws the first task finished. If the figure starts offscreen it
 * opens as a plain grid and swings into place when it scrolls into view. It
 * steps through the tasks only while it is on screen, until it is paused or a
 * task is picked, and not at all with reduced motion.
 */
const HOLD = 5600;
const arm = (element: HTMLElement) => element.classList.add("is-armed");
const enter = (element: HTMLElement) => element.classList.remove("is-armed");
const hopName = (hop: number) => (hop === 0 ? "Anchor" : `${hop} ${hop === 1 ? "import" : "imports"} out`);

export function LocusFigure() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [onScreen, setOnScreen] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  useEnterView(rootRef, arm, enter, 0.25);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(Boolean(entry?.isIntersecting)), { threshold: 0.35 });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  const running = playing && onScreen && hovered === null;
  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => setIndex((current) => (current + 1) % LOCALIZATIONS.length), HOLD);
    return () => window.clearTimeout(timer);
  }, [running, index]);

  const pick = (next: number) => {
    setPlaying(false);
    setHovered(null);
    setIndex(next);
  };

  const current = LOCALIZATIONS[index];
  const file = hovered === null ? null : { path: FILES[hovered], place: current.places[hovered] };
  const touched = hovered === null ? null : new Set(current.edges.filter(({ from, to }) => from === hovered || to === hovered).flatMap(({ from, to }) => [from, to]));

  return (
    <div ref={rootRef} className="orbit grid items-center gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16" data-running={running}>
      <div className="min-w-0">
        <ul className="border-t border-ink">
          {LOCALIZATIONS.map((item, i) => (
            <li key={item.task} className="relative border-b border-line">
              <button
                type="button"
                onClick={() => pick(i)}
                aria-pressed={i === index}
                className={`grid w-full grid-cols-[28px_minmax(0,1fr)_auto] items-baseline gap-x-2 py-4 text-left transition-colors duration-150 ${i === index ? "text-ink" : "text-muted hover:text-ink-2"}`}
              >
                <span className="font-mono text-[11px] tabular-nums">0{i + 1}</span>
                <span className="text-[16px] leading-6">{item.task}</span>
                <span className={`font-mono text-[12px] tabular-nums ${i === index ? "text-included-ink" : ""}`}>
                  {item.widened ? "Widened" : `${item.inSlice} / ${FILES.length}`}
                </span>
              </button>
              {i === index && <span key={index} aria-hidden="true" className="orbit-progress" style={{ "--hold": `${HOLD}ms` } as CSSProperties} />}
            </li>
          ))}
        </ul>

        <div className="mt-8 grid grid-cols-2 gap-x-8">
          <p>
            <RollNumber value={current.inSlice} className="block font-display text-[clamp(38px,12vw,56px)] leading-none tracking-[-0.02em] text-included-ink tabular-nums" />
            <span className="mt-2 block font-mono text-[11px] uppercase tracking-[0.1em] text-muted">In the Slice</span>
          </p>
          <p>
            <RollNumber value={current.sliceTokens} className="block font-display text-[clamp(38px,12vw,56px)] leading-none tracking-[-0.02em] text-ink tabular-nums" />
            <span className="mt-2 block font-mono text-[11px] uppercase tracking-[0.1em] text-muted">Tokens of {current.totalTokens.toLocaleString("en-US")}</span>
          </p>
        </div>

        <div className="mt-8 flex min-h-12 flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <p className="min-w-0 flex-1 font-mono text-[12px] leading-6 text-ink-2 [overflow-wrap:anywhere]">
            {file ? (
              <>
                <span className="text-ink">{file.path}</span>
                <span className="block text-muted">{file.place.hop === -1 ? "Left out" : current.widened ? "Kept: the task matched nothing" : hopName(file.place.hop)}</span>
              </>
            ) : current.widened ? (
              "No file matched well enough, so Locus kept every one instead of guessing."
            ) : (
              current.perHop.map((count, hop) => (
                <span key={hop} className="mr-5 inline-block whitespace-nowrap">
                  {hop === 0 ? "Anchors" : hopName(hop)} <span className="text-ink tabular-nums">{count}</span>
                </span>
              ))
            )}
          </p>
          <button
            type="button"
            onClick={() => setPlaying((value) => !value)}
            className="orbit-toggle inline-flex h-9 shrink-0 items-center gap-2 rounded-chip border border-line-2 px-3 text-[13px] text-ink-2 transition-colors duration-150 hover:border-ink hover:text-ink"
          >
            <span aria-hidden="true" className={playing ? "orbit-pause" : "orbit-play"} />
            {playing ? "Pause" : "Play"}
          </button>
        </div>
      </div>

      <svg
        viewBox="-380 -380 760 760"
        role="img"
        aria-label={
          current.widened
            ? `"${current.task}": Widened, all ${FILES.length} files kept.`
            : `"${current.task}": ${current.inSlice} of ${FILES.length} files in the Slice, ${current.perHop.map((count, hop) => `${count} ${hopName(hop)}`).join(", ")}.`
        }
        className="mx-auto block w-full max-w-[640px] touch-pan-y"
        onPointerLeave={() => setHovered(null)}
      >
        {/* The dial: ticks that turn with the scroll, one hairline per ring. */}
        <g aria-hidden="true">
          <g className="orbit-bezel">
            <circle r={365} fill="none" stroke="var(--muted)" strokeWidth={8} strokeDasharray="1 11.74" pathLength={365 * 2 * Math.PI} />
          </g>
          {[...RINGS, RIM].map((radius) => (
            <circle key={radius} r={radius} fill="none" stroke="var(--line-2)" strokeDasharray={radius === RIM ? undefined : "2 5"} />
          ))}
          <path d="M-9 0H9M0 -9V9" stroke="var(--muted)" />
          {FOLDERS.map(({ label, angle }) => {
            // Set along the dial's margin; below the middle it runs the other way, so it never reads upside down.
            const below = Math.sin((angle * Math.PI) / 180) > 0;
            const radius = RIM + (below ? 26 : 16);
            const [a, b] = (below ? [angle + 40, angle - 40] : [angle - 40, angle + 40]).map((at) => point({ angle: at, radius, hop: 0, turn: 0 }));
            const id = `orbit-arc-${label.slice(0, -1)}`;
            return (
              <g key={label}>
                <path id={id} d={`M${a.x} ${a.y}A${radius} ${radius} 0 0 ${below ? 0 : 1} ${b.x} ${b.y}`} fill="none" />
                <text textAnchor="middle" className="orbit-label">
                  <textPath href={`#${id}`} startOffset="50%">{label}</textPath>
                </text>
              </g>
            );
          })}
          <circle key={`ping-${index}`} r={RIM} className="orbit-ping" />
          <g key={`edges-${index}`} className="orbit-edges">
            {current.edges.map(({ from, to, hop }) => {
              const a = point(current.places[from]);
              const b = point(current.places[to]);
              const lit = hovered === null || hovered === from || hovered === to;
              return <path key={`${from}-${to}`} d={`M${a.x} ${a.y}L${b.x} ${b.y}`} pathLength={1} className="orbit-edge" style={{ "--hop": hop, opacity: lit ? undefined : 0.08 } as CSSProperties} />;
            })}
          </g>
          {FILES.map((path, i) => {
            const place = current.places[i];
            const kind = place.hop === -1 ? "out" : place.hop === 0 && !current.widened ? "anchor" : "in";
            return (
              <g
                key={path}
                className="orbit-mark"
                data-kind={kind}
                data-dim={touched && hovered !== i && !touched.has(i) && kind !== "out" ? "" : undefined}
                onPointerEnter={() => setHovered(i)}
                style={{
                  "--a": `${place.angle}deg`,
                  "--r": `${place.radius}px`,
                  "--t": `${place.turn}deg`,
                  "--ga": `${GRID[i].angle}deg`,
                  "--gr": `${GRID[i].radius}px`,
                  "--gt": `${GRID[i].turn}deg`,
                  "--d": `${Math.max(0, place.hop) * 110 + ((i * 37) % 50) * 5}ms`,
                } as CSSProperties}
              >
                <rect className="orbit-hit" x={-9} y={-11} width={18} height={22} />
                <rect className="orbit-square" x={-5.5} y={-5.5} width={11} height={11} rx={1.5} />
                <rect className="orbit-hole" x={-2} y={-2} width={4} height={4} rx={0.5} />
              </g>
            );
          })}
          {FILES.map((path, i) =>
            current.places[i].hop !== -1 && !current.widened ? (
              <circle key={path} {...(({ x, y }) => ({ cx: x, cy: y }))(point({ angle: rimAngle(i), radius: RIM, hop: 0, turn: 0 }))} r={1.5} fill="var(--included)" opacity={0.7} pointerEvents="none" />
            ) : null,
          )}
        </g>
      </svg>
    </div>
  );
}

"use client";

import { useRef } from "react";

type ContextLensProps = {
  included: number;
  excluded: number;
  reduction: number;
  active: boolean;
};

const INCLUDED_NODES = [
  [88, 114], [139, 178], [75, 260], [184, 296], [221, 94], [264, 222],
];

const EXCLUDED_NODES = [
  [94, 62], [167, 340], [254, 52], [305, 327], [354, 82], [376, 298],
];

export function ContextLens({
  included,
  excluded,
  reduction,
  active,
}: ContextLensProps) {
  const lensRef = useRef<HTMLElement>(null);

  function moveLens(event: React.PointerEvent<HTMLElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
    const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
    lensRef.current?.style.setProperty("--lens-x", `${x * 7}px`);
    lensRef.current?.style.setProperty("--lens-y", `${y * 7}px`);
  }

  function resetLens() {
    lensRef.current?.style.setProperty("--lens-x", "0px");
    lensRef.current?.style.setProperty("--lens-y", "0px");
  }

  return (
    <section
      ref={lensRef}
      aria-label={`Context lens: ${included} files included, ${excluded} excluded, ${reduction}% fewer tokens`}
      className="context-lens group relative min-h-[390px] overflow-hidden rounded-[30px] border border-white/10 bg-[#07101f] shadow-[0_40px_120px_rgba(0,0,0,0.35)]"
      onPointerMove={moveLens}
      onPointerLeave={resetLens}
    >
      <div className="context-lens__grid absolute inset-0" aria-hidden="true" />
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-5 sm:p-6">
        <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-white/55">
          <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-accent shadow-[0_0_12px_var(--accent)]" : "bg-white/30"}`} />
          Context optics
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-white/45">
          {active ? "Live slice" : "Awaiting source"}
        </span>
      </div>

      <svg
        className="context-lens__scene absolute inset-0 h-full w-full"
        viewBox="0 0 720 400"
        role="img"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="beam" x1="0" x2="1">
            <stop offset="0" stopColor="#6687ff" stopOpacity="0" />
            <stop offset=".58" stopColor="#6687ff" stopOpacity=".28" />
            <stop offset="1" stopColor="#6ce5ca" stopOpacity=".64" />
          </linearGradient>
          <radialGradient id="optic" cx=".5" cy=".5" r=".5">
            <stop offset="0" stopColor="#f3f7ff" />
            <stop offset=".16" stopColor="#6ce5ca" />
            <stop offset=".48" stopColor="#6687ff" stopOpacity=".32" />
            <stop offset="1" stopColor="#6687ff" stopOpacity="0" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="7" />
          </filter>
        </defs>

        <path d="M36 92 L505 184 L505 216 L36 308 Z" fill="url(#beam)" opacity={active ? ".9" : ".34"} />
        <path d="M36 92 L505 184" stroke="#6687ff" strokeOpacity=".26" strokeWidth="1" />
        <path d="M36 308 L505 216" stroke="#6687ff" strokeOpacity=".26" strokeWidth="1" />
        <path d="M505 184 L690 197 L690 203 L505 216 Z" fill="#6ce5ca" opacity={active ? ".2" : ".06"} />

        {INCLUDED_NODES.map(([x, y], index) => (
          <g key={`in-${x}-${y}`} className="context-node context-node--included" style={{ animationDelay: `${index * -0.7}s` }}>
            <circle cx={x} cy={y} r="8" fill="#6ce5ca" fillOpacity=".1" />
            <circle cx={x} cy={y} r="3" fill="#6ce5ca" />
            <path d={`M${x + 8} ${y} L505 200`} stroke="#6ce5ca" strokeOpacity=".1" strokeWidth=".7" />
          </g>
        ))}
        {EXCLUDED_NODES.map(([x, y], index) => (
          <g key={`out-${x}-${y}`} className="context-node context-node--excluded" style={{ animationDelay: `${index * -0.9}s` }}>
            <circle cx={x} cy={y} r="7" fill="#73809a" fillOpacity=".08" />
            <circle cx={x} cy={y} r="2.5" fill="#73809a" fillOpacity=".5" />
          </g>
        ))}

        <circle cx="505" cy="200" r="86" fill="url(#optic)" opacity=".18" filter="url(#glow)" />
        <circle cx="505" cy="200" r="54" fill="none" stroke="#6ce5ca" strokeOpacity=".2" />
        <circle cx="505" cy="200" r="42" fill="none" stroke="#f3f7ff" strokeOpacity=".11" strokeDasharray="2 6" />
        <circle cx="505" cy="200" r="25" fill="url(#optic)" opacity={active ? ".9" : ".38"} />
        <circle cx="505" cy="200" r="4" fill="#f3f7ff" />
        <path d="M505 132 V268 M437 200 H573" stroke="#f3f7ff" strokeOpacity=".09" strokeWidth=".7" />
      </svg>

      <div className="absolute inset-0 z-10 grid place-items-center">
        <div className="context-lens__readout ml-[40%] mt-1 text-center">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/45">Context removed</p>
          <p className="mt-1 text-5xl font-semibold tracking-[-0.08em] text-white tabular sm:text-6xl">
            {active ? `${reduction}%` : "—"}
          </p>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 grid grid-cols-3 border-t border-white/10 bg-[#07101f]/75 backdrop-blur-md">
        <div className="border-r border-white/10 px-4 py-4 sm:px-5">
          <p className="font-mono text-lg font-semibold text-accent tabular">{included}</p>
          <p className="mt-0.5 text-[10px] text-white/45">included</p>
        </div>
        <div className="border-r border-white/10 px-4 py-4 sm:px-5">
          <p className="font-mono text-lg font-semibold text-white/65 tabular">{excluded}</p>
          <p className="mt-0.5 text-[10px] text-white/45">left outside</p>
        </div>
        <div className="px-4 py-4 sm:px-5">
          <p className="font-mono text-lg font-semibold text-white tabular">{active ? "SAFE" : "IDLE"}</p>
          <p className="mt-0.5 text-[10px] text-white/45">scope state</p>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useRef } from "react";

type ContextLensProps = {
  included: number;
  excluded: number;
  reduction: number;
  active: boolean;
};

const INCLUDED_NODES = [
  [72, 102], [112, 164], [76, 250], [162, 300], [212, 92], [236, 220],
];

const EXCLUDED_NODES = [
  [58, 342], [122, 352], [198, 340], [268, 350],
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
      className="context-lens group relative min-h-[390px] overflow-hidden rounded-[28px] border border-white/20 bg-[#314fd1] shadow-[0_28px_70px_rgba(20,35,59,0.24)]"
      onPointerMove={moveLens}
      onPointerLeave={resetLens}
    >
      <div className="context-lens__grid absolute inset-0" aria-hidden="true" />
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-5 sm:p-6">
        <div className="flex items-center gap-2 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-white/75">
          <span className={`h-2 w-2 rounded-sm ${active ? "bg-accent" : "bg-white/30"}`} />
          Live context route
        </div>
        <span className="rounded-full border border-white/20 bg-[#183154]/50 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-white/75">
          {active ? "Routing now" : "Awaiting source"}
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
            <stop offset="0" stopColor="#8ef0c0" stopOpacity=".08" />
            <stop offset=".58" stopColor="#8ef0c0" stopOpacity=".3" />
            <stop offset="1" stopColor="#8ef0c0" stopOpacity=".6" />
          </linearGradient>
        </defs>

        <path d="M36 78 C180 78 214 182 354 182 L414 182" fill="none" stroke="url(#beam)" strokeWidth="14" opacity={active ? ".95" : ".35"} />
        <path d="M36 268 C168 268 236 218 354 218 L414 218" fill="none" stroke="url(#beam)" strokeWidth="14" opacity={active ? ".95" : ".35"} />
        <path d="M414 182 Q448 182 448 216 V238 Q448 258 472 258 H690" fill="none" stroke="#8ef0c0" strokeWidth="14" strokeLinecap="round" opacity={active ? ".9" : ".3"} />
        <path d="M414 218 Q448 218 448 184 V162 Q448 142 472 142 H690" fill="none" stroke="#ffd45c" strokeWidth="6" strokeLinecap="round" opacity={active ? ".9" : ".3"} />
        <path d="M36 334 H298 Q322 334 322 310 V292" fill="none" stroke="#ff896e" strokeWidth="4" strokeDasharray="5 8" strokeLinecap="round" opacity=".8" />

        {INCLUDED_NODES.map(([x, y], index) => (
          <g key={`in-${x}-${y}`} className="context-node context-node--included" style={{ animationDelay: `${index * -0.7}s` }}>
            <rect x={x - 7} y={y - 7} width="14" height="14" rx="3" fill="#183154" fillOpacity=".72" />
            <circle cx={x} cy={y} r="2.7" fill="#8ef0c0" />
          </g>
        ))}
        {EXCLUDED_NODES.map(([x, y], index) => (
          <g key={`out-${x}-${y}`} className="context-node context-node--excluded" style={{ animationDelay: `${index * -0.9}s` }}>
            <circle cx={x} cy={y} r="5" fill="#ff896e" fillOpacity=".2" />
            <circle cx={x} cy={y} r="2.5" fill="#ff896e" />
          </g>
        ))}

        <rect x="396" y="158" width="104" height="84" rx="22" fill="#183154" stroke="#ffffff" strokeOpacity=".22" />
        <circle cx="448" cy="200" r="15" fill="#8ef0c0" />
        <path d="M442 200 L447 205 L456 194" fill="none" stroke="#183154" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="576" y="121" width="110" height="42" rx="12" fill="#183154" fillOpacity=".86" />
        <rect x="576" y="237" width="110" height="42" rx="12" fill="#183154" fillOpacity=".86" />
        <text x="631" y="147" textAnchor="middle" fill="#ffd45c" fontSize="10" fontFamily="monospace">PLAN</text>
        <text x="631" y="263" textAnchor="middle" fill="#8ef0c0" fontSize="10" fontFamily="monospace">SHIP</text>
        <text x="36" y="323" fill="#ffb2a1" fontSize="9" fontFamily="monospace">EXCLUDED / NEVER PACKED</text>
      </svg>

      <div className="absolute inset-0 z-10 pointer-events-none">
        <div className="context-lens__readout absolute left-[48%] top-[43%] -translate-x-1/2 -translate-y-1/2 text-center">
          <p className="font-mono text-[8px] uppercase tracking-[0.18em] text-white/55">safe slice</p>
          <p className="mt-0.5 text-lg font-semibold tracking-[-0.05em] text-white">
            {active ? `${reduction}% leaner` : "standby"}
          </p>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 grid grid-cols-3 border-t border-white/15 bg-[#183154]/90 backdrop-blur-md">
        <div className="border-r border-white/10 px-4 py-4 sm:px-5">
          <p className="font-mono text-lg font-semibold text-accent tabular">{included}</p>
          <p className="mt-0.5 text-[10px] text-white/55">files routed in</p>
        </div>
        <div className="border-r border-white/10 px-4 py-4 sm:px-5">
          <p className="font-mono text-lg font-semibold text-recent tabular">{excluded}</p>
          <p className="mt-0.5 text-[10px] text-white/55">held outside</p>
        </div>
        <div className="px-4 py-4 sm:px-5">
          <p className="font-mono text-lg font-semibold text-[#ffd45c] tabular">{active ? "READY" : "IDLE"}</p>
          <p className="mt-0.5 text-[10px] text-white/55">agent route</p>
        </div>
      </div>
    </section>
  );
}

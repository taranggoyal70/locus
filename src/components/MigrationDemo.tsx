"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const stages = [
  { label: "Change", note: "Provider publishes an SDK migration contract" },
  { label: "Localize", note: "Locus admits seven evidence-backed files" },
  { label: "Patch", note: "The agent works inside the admitted Slice" },
  { label: "Review", note: "Maintainer receives checks and scope evidence" },
] as const;

const graphNodes = [
  [68, 78, false], [132, 52, false], [202, 76, false], [284, 49, false], [360, 86, false],
  [46, 166, false], [116, 142, true], [194, 154, true], [279, 137, false], [382, 170, false],
  [70, 247, false], [142, 232, true], [220, 220, true], [304, 239, true], [384, 252, false],
  [48, 340, false], [124, 330, false], [205, 312, true], [286, 330, true], [372, 350, false],
] as const;

const diffLines = [
  { kind: "context", text: "async function createPayment(input: CheckoutInput) {" },
  { kind: "remove", text: "−  return atlas.payments.create({ source: input.token })" },
  { kind: "add", text: "+  return atlas.paymentIntents.create({" },
  { kind: "add", text: "+    paymentMethod: input.token," },
  { kind: "add", text: "+    confirm: true" },
  { kind: "add", text: "+  })" },
  { kind: "context", text: "}" },
] as const;

export function MigrationDemo() {
  const [stage, setStage] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  function play() {
    clearTimers();
    setStage(1);
    setPlaying(true);
    [2, 3, 4].forEach((nextStage, index) => {
      timers.current.push(setTimeout(() => setStage(nextStage), 1600 * (index + 1)));
    });
    timers.current.push(setTimeout(() => setPlaying(false), 1600 * 3 + 900));
  }

  function inspect(nextStage: number) {
    clearTimers();
    setPlaying(false);
    setStage(nextStage);
  }

  useEffect(() => () => clearTimers(), []);

  const activeStage = stages[Math.max(stage - 1, 0)];

  return (
    <div className="migration-demo" data-stage={stage} data-playing={playing || undefined}>
      <div className="mx-auto max-w-[1480px] px-4 pb-10 pt-6 sm:px-6 lg:px-8 lg:pb-16">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[#8ef0c0]/35 bg-[#8ef0c0]/10 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8ef0c0]">
              Interactive vision demo
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#a7b7c7]">
              Fictional data · simulated sequence · no external writes
            </span>
          </div>
          <Link href="/workspace" className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-[#d7e2ec] transition hover:text-[#8ef0c0]">
            Try the live Localizer →
          </Link>
        </div>

        <header className="grid gap-7 py-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end lg:py-14">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-[#8ef0c0]">A proposed first workflow</p>
            <h1 className="mt-4 max-w-5xl font-display text-[clamp(3.2rem,7vw,7.2rem)] font-semibold leading-[.84] tracking-[-0.07em] text-white">
              Don&apos;t announce the breaking change.
              <span className="mt-2 block text-[#8ef0c0]">Ship the migration.</span>
            </h1>
          </div>
          <div className="border-l border-white/20 pl-5">
            <p className="text-sm leading-6 text-[#bfccd8]">
              This scenario shows the API-migration workflow Locus is validating—not a shipped or measured customer outcome.
            </p>
            <button
              type="button"
              onClick={play}
              className="mt-5 inline-flex min-w-48 items-center justify-center gap-3 rounded-full bg-[#8ef0c0] px-5 py-3 text-sm font-semibold text-[#14233b] transition hover:-translate-y-0.5 hover:bg-white disabled:cursor-wait disabled:opacity-80"
              disabled={playing}
            >
              <span className="text-lg leading-none" aria-hidden="true">{playing ? "◌" : stage === 4 ? "↻" : "▶"}</span>
              {playing ? "Migration running" : stage === 4 ? "Replay the sequence" : "Run the sequence"}
            </button>
          </div>
        </header>

        <div className="migration-console overflow-hidden rounded-[26px] border border-white/15 bg-[#0d1a2d]/90 shadow-[0_36px_120px_rgba(0,0,0,.35)]">
          <div className="grid min-h-[620px] lg:grid-cols-[minmax(260px,.72fr)_minmax(440px,1.2fr)_minmax(320px,1fr)]">
            <section className="border-b border-white/15 p-5 sm:p-7 lg:border-b-0 lg:border-r" aria-labelledby="provider-change-title">
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[#91a4b6]">Provider signal</p>
                <span className="rounded-full border border-[#e7b853]/30 bg-[#e7b853]/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[#f2c76d]">Breaking</span>
              </div>
              <h2 id="provider-change-title" className="mt-7 font-display text-3xl font-semibold tracking-[-0.04em] text-white">Atlas SDK v3</h2>
              <p className="mt-2 text-sm leading-6 text-[#aebdcc]">Fictional payment SDK migration contract</p>

              <div className="mt-7 rounded-2xl border border-white/10 bg-white/[.035] p-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#e7b853]/15 font-mono text-xs font-bold text-[#f2c76d]">v3</span>
                  <div>
                    <p className="text-sm font-semibold text-white">Remove token sources</p>
                    <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.1em] text-[#91a4b6]">Published 09:42 UTC</p>
                  </div>
                </div>
                <div className="mt-5 space-y-3 font-mono text-xs leading-5">
                  <p className="rounded-lg bg-[#f38d7c]/10 px-3 py-2 text-[#ffb7aa] line-through decoration-[#f38d7c]/60">payments.create({`{ source }`})</p>
                  <p className="rounded-lg bg-[#8ef0c0]/10 px-3 py-2 text-[#a9f5d0]">paymentIntents.create({`{ paymentMethod }`})</p>
                </div>
              </div>

              <div className="mt-7 border-t border-white/10 pt-6">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#91a4b6]">Target repository</p>
                <p className="mt-2 text-sm font-semibold text-white">northstar/checkout</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/10 p-3">
                    <p className="font-display text-2xl font-semibold text-white">1,842</p>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[#91a4b6]">Repo files</p>
                  </div>
                  <div className="rounded-xl border border-white/10 p-3">
                    <p className="font-display text-2xl font-semibold text-white">6</p>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[#91a4b6]">Known usages</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="relative flex min-h-[560px] flex-col items-center justify-center overflow-hidden border-b border-white/15 p-5 sm:p-7 lg:border-b-0 lg:border-r" aria-label="Repository aperture visualization">
              <div className="migration-demo__grid absolute inset-0" aria-hidden="true" />
              <div className="absolute left-5 top-5 z-10 sm:left-7 sm:top-7">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[#91a4b6]">Repository aperture</p>
                <p className="mt-2 max-w-xs text-xs leading-5 text-[#aebdcc]">Every admitted file needs evidence. Everything else stays outside the Run.</p>
              </div>

              <div className="migration-aperture relative mt-14 aspect-square w-full max-w-[440px]" aria-hidden="true">
                <div className="migration-aperture__halo absolute inset-[6%] rounded-full" />
                <svg viewBox="0 0 440 440" className="absolute inset-0 h-full w-full overflow-visible">
                  <circle cx="220" cy="220" r="186" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="1" strokeDasharray="3 8" />
                  <circle className="migration-aperture__orbit" cx="220" cy="220" r="158" fill="none" stroke="rgba(142,240,192,.5)" strokeWidth="1.5" strokeDasharray="2 11" />
                  {graphNodes.map(([x, y, included], index) => (
                    <g key={`${x}-${y}`} className={included ? "migration-graph-node migration-graph-node--included" : "migration-graph-node migration-graph-node--excluded"}>
                      <line x1={x} y1={y} x2="220" y2="220" stroke={included ? "rgba(142,240,192,.3)" : "rgba(174,189,204,.12)"} strokeWidth="1" />
                      <circle cx={x} cy={y} r={included ? 6 : index % 3 === 0 ? 4 : 3} fill={included ? "#8ef0c0" : "#718398"} />
                    </g>
                  ))}
                </svg>
                <div className="migration-aperture__core absolute inset-[28%] grid place-items-center rounded-full border border-[#8ef0c0]/35 bg-[#0d1a2d]/95 text-center shadow-[0_0_70px_rgba(142,240,192,.12)]">
                  <div>
                    <p className="migration-aperture__count font-display text-5xl font-semibold tracking-[-0.06em] text-white">{stage >= 2 ? "7" : "1,842"}</p>
                    <p className="mt-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8ef0c0]">{stage >= 2 ? "files admitted" : "files observed"}</p>
                  </div>
                </div>
              </div>

              <div className="relative z-10 mt-4 grid w-full max-w-md grid-cols-3 gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 text-center">
                <div className="bg-[#0d1a2d] p-3"><p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#91a4b6]">Admitted</p><p className="mt-1 text-sm font-semibold text-[#8ef0c0]">{stage >= 2 ? "7" : "—"}</p></div>
                <div className="bg-[#0d1a2d] p-3"><p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#91a4b6]">Excluded</p><p className="mt-1 text-sm font-semibold text-white">{stage >= 2 ? "1,835" : "—"}</p></div>
                <div className="bg-[#0d1a2d] p-3"><p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#91a4b6]">Widened</p><p className="mt-1 text-sm font-semibold text-white">{stage >= 2 ? "0" : "—"}</p></div>
              </div>
            </section>

            <section className="relative flex flex-col p-5 sm:p-7" aria-labelledby="proposal-title">
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[#91a4b6]">Proposed change</p>
                <span className={`rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] ${stage >= 4 ? "border-[#8ef0c0]/30 bg-[#8ef0c0]/10 text-[#8ef0c0]" : "border-white/15 text-[#91a4b6]"}`}>
                  {stage >= 4 ? "Ready for human review" : "Waiting"}
                </span>
              </div>
              <h2 id="proposal-title" className="mt-7 font-display text-3xl font-semibold tracking-[-0.04em] text-white">Migration packet</h2>
              <p className="mt-2 text-sm leading-6 text-[#aebdcc]">A proposed patch plus factual evidence—not an automatic approval.</p>

              <div aria-hidden={stage < 3} className={`migration-diff mt-6 overflow-hidden rounded-2xl border border-white/10 bg-[#081322] transition ${stage >= 3 ? "migration-diff--visible" : ""}`}>
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <p className="font-mono text-[11px] text-[#d7e2ec]">src/server/payments.ts</p>
                  <p className="font-mono text-[10px] text-[#91a4b6]">+4 −1</p>
                </div>
                <div className="overflow-x-auto py-3 font-mono text-xs leading-6">
                  {diffLines.map((line, index) => (
                    <div key={`${line.kind}-${index}`} className={`migration-diff__line migration-diff__line--${line.kind} min-w-[440px] px-4`} style={{ transitionDelay: `${index * 55}ms` }}>
                      {line.text}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 space-y-2.5">
                {[
                  ["pnpm test", "142 passed"],
                  ["pnpm typecheck", "exit 0"],
                  ["Scope deviations", "none detected"],
                ].map(([label, value], index) => (
                  <div aria-hidden={stage < 3} key={label} className={`migration-check flex items-center justify-between rounded-xl border border-white/10 px-3.5 py-3 ${stage >= 3 ? "migration-check--visible" : ""}`} style={{ transitionDelay: `${420 + index * 110}ms` }}>
                    <span className="font-mono text-[11px] text-[#bdcad8]">{label}</span>
                    <span className="flex items-center gap-2 font-mono text-[11px] font-semibold text-[#8ef0c0]"><span aria-hidden="true">✓</span>{value}</span>
                  </div>
                ))}
              </div>

              <div aria-hidden={stage < 4} className={`migration-review-stamp mt-auto pt-7 ${stage >= 4 ? "migration-review-stamp--visible" : ""}`}>
                <div className="rounded-2xl border border-[#8ef0c0]/25 bg-[#8ef0c0]/[.07] p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#8ef0c0] font-bold text-[#14233b]">✓</span>
                    <div>
                      <p className="text-sm font-semibold text-white">Evidence packet assembled</p>
                      <p className="mt-1 text-xs leading-5 text-[#aebdcc]">A maintainer still decides whether the change is correct and whether a pull request may be opened.</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="border-t border-white/15 bg-[#091526] px-4 py-4 sm:px-6">
            <div className="relative h-px bg-white/10" aria-hidden="true"><div className="migration-progress absolute inset-y-0 left-0 bg-[#8ef0c0]" style={{ width: `${stage * 25}%` }} /></div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {stages.map((item, index) => {
                const itemStage = index + 1;
                const active = itemStage === stage;
                const complete = itemStage < stage;
                return (
                  <button key={item.label} type="button" onClick={() => inspect(itemStage)} className={`rounded-xl px-3 py-3 text-left transition ${active ? "bg-white/10" : "hover:bg-white/[.05]"}`} aria-current={active ? "step" : undefined}>
                    <span className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-white">
                      <span className={`grid h-5 w-5 place-items-center rounded-full border text-[10px] ${active || complete ? "border-[#8ef0c0] bg-[#8ef0c0] text-[#14233b]" : "border-white/20 text-[#91a4b6]"}`}>{complete ? "✓" : itemStage}</span>
                      {item.label}
                    </span>
                    <span className="mt-2 hidden text-xs leading-4 text-[#91a4b6] sm:block">{item.note}</span>
                  </button>
                );
              })}
            </div>
            <p className="sr-only" aria-live="polite">{stage === 0 ? "Demo ready" : `${activeStage.label}: ${activeStage.note}`}</p>
          </div>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-2" aria-label="Demo capability boundaries">
          <div className="rounded-2xl border border-white/15 bg-white/[.035] p-5">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8ef0c0]">Real in early access today</p>
            <p className="mt-3 text-sm leading-6 text-[#bdcad8]">Public JavaScript and TypeScript Repo localization, visible Included and Excluded files, evidence-backed Widening, and invite-gated isolated Agent Runs.</p>
          </div>
          <div className="rounded-2xl border border-[#e7b853]/20 bg-[#e7b853]/[.04] p-5">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#f2c76d]">Being validated next</p>
            <p className="mt-3 text-sm leading-6 text-[#bdcad8]">Provider change intake, affected-repository campaigns, verified migration patches, maintainer authorization, and delivery into customer pull requests.</p>
          </div>
        </section>
      </div>
    </div>
  );
}

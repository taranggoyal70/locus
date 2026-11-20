"use client";

import Link from "next/link";
import { demoCapabilitySummary } from "@/lib/admission-copy";
import { useEffect, useRef, useState } from "react";

const developerStages = [
  { label: "Task", note: "Issue and base commit are frozen" },
  { label: "Contain", note: "Only seven admitted files enter the sandbox" },
  { label: "Checks run", note: "Candidate-bound commands record factual evidence" },
  { label: "Sign", note: "Ed25519 binds the exact review-ready proposal" },
] as const;

const plainStages = [
  { label: "Task received", note: "The requested fix is recorded" },
  { label: "Safe area set", note: "Seven relevant files are approved" },
  { label: "Extra access blocked", note: "The agent cannot open excluded Repo files" },
  { label: "Signed proof ready", note: "The exact fix and Checks are signed together" },
] as const;

const graphNodes = [
  [68, 78, false], [132, 52, false], [202, 76, false], [284, 49, false], [360, 86, false],
  [46, 166, false], [116, 142, true], [194, 154, true], [279, 137, false], [382, 170, false],
  [70, 247, false], [142, 232, true], [220, 220, true], [304, 239, true], [384, 252, false],
  [48, 340, false], [124, 330, false], [205, 312, true], [286, 330, true], [372, 350, false],
] as const;

const diffLines = [
  { kind: "context", text: "async function retryInvoice(invoice: Invoice) {" },
  { kind: "remove", text: "−  return charge(invoice)" },
  { kind: "add", text: "+  return once(invoice.id, () =>" },
  { kind: "add", text: "+    charge(invoice)" },
  { kind: "add", text: "+  )" },
  { kind: "context", text: "}" },
] as const;

export function MigrationDemo({ selfServeOpen }: { selfServeOpen: boolean }) {
  const [audience, setAudience] = useState<"plain" | "developer">("plain");
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

  const plainLanguage = audience === "plain";
  const stages = plainLanguage ? plainStages : developerStages;
  const activeStage = stages[Math.max(stage - 1, 0)];
  const checks = plainLanguage
    ? [["Automated tests", "142 passed"], ["Approved files only", "enforced"], ["Signed receipt", "verified"]]
    : [["pnpm test", "exit 0 · output hashed"], ["Working-tree candidate", "sha256 · matched"], ["Ed25519 signature", "key ID trusted"]];

  return (
    <div className="migration-demo bg-canvas text-ink" data-band="dark" data-audience={audience} data-stage={stage} data-playing={playing || undefined}>
      <div className="mx-auto max-w-[1480px] px-4 pb-10 pt-6 sm:px-6 lg:px-8 lg:pb-16">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-2 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-chip border border-line-2 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-2">
              Interactive vision demo
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-2">
              {plainLanguage ? "Illustrative story · no customer systems touched" : "Fictional data · simulated sequence · no external writes"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-chip border border-line-2 bg-surface p-1" role="group" aria-label="Choose explanation level">
              <button type="button" onClick={() => setAudience("plain")} aria-pressed={plainLanguage} className={`rounded-chip px-3 py-1.5 text-xs font-semibold transition ${plainLanguage ? "bg-ink text-canvas" : "text-ink-2 hover:text-ink"}`}>
                Plain English
              </button>
              <button type="button" onClick={() => setAudience("developer")} aria-pressed={!plainLanguage} className={`rounded-chip px-3 py-1.5 text-xs font-semibold transition ${!plainLanguage ? "bg-ink text-canvas" : "text-ink-2 hover:text-ink"}`}>
                Developer evidence
              </button>
            </div>
            <Link href="/workspace" className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-ink transition hover:text-included">
              {plainLanguage ? "Try it on a public project →" : "Try the live Localizer →"}
            </Link>
          </div>
        </div>

        <header className="grid gap-7 py-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end lg:py-14">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-included">{plainLanguage ? "One task. 1,842 files." : "Locus Guard pilot"}</p>
            <h1 className="mt-4 max-w-5xl font-display text-[clamp(3.2rem,7vw,7.2rem)] font-normal leading-[0.98] tracking-[-0.02em] text-ink">
              {plainLanguage ? "Your AI changed the code." : "Let agents code."}
              <span className="mt-2 block text-ink-2">{plainLanguage ? "Locus proves what it touched." : "Gate what can merge."}</span>
            </h1>
          </div>
          <div className="border-l border-line-2 pl-5">
            <p className="text-sm leading-6 text-ink-2">
              {plainLanguage
                ? "Locus gives the coding agent only the approved Repo files, blocks excluded Repo access, runs your Checks, and signs one receipt for the exact fix. This is an illustrative pilot, not a customer result."
                : "This simulated sequence shows the v0.4 contained runner, working-tree candidate hash, factual Check evidence, provider-reported usage, Ed25519 signature, and immutable human Review."}
            </p>
            <button
              type="button"
              onClick={play}
              className="mt-5 inline-flex min-w-48 items-center justify-center gap-3 rounded-card bg-ink px-5 py-3 text-sm font-semibold text-canvas transition-[background-color,transform] duration-150 hover:bg-ink/90 active:scale-[0.97] disabled:cursor-wait disabled:opacity-80"
              disabled={playing}
            >
              <span className="text-lg leading-none" aria-hidden="true">{playing ? "◌" : stage === 4 ? "↻" : "▶"}</span>
              {plainLanguage
                ? playing ? "Guard checking" : stage === 4 ? "Replay the story" : "Show me how it works"
                : playing ? "Guard running" : stage === 4 ? "Replay the sequence" : "Run the sequence"}
            </button>
          </div>
        </header>

        <div className="overflow-hidden rounded-card border border-line-2 bg-surface shadow-panel">
          <div className="grid min-h-[620px] lg:grid-cols-[minmax(260px,.72fr)_minmax(440px,1.2fr)_minmax(320px,1fr)]">
            <section className="border-b border-line-2 p-5 sm:p-7 lg:border-b-0 lg:border-r" aria-labelledby="agent-task-title">
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{plainLanguage ? "An AI receives a coding task" : "Agent Task"}</p>
                <span className="rounded-chip border border-widened/30 bg-widened/10 px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-widened">{plainLanguage ? "Needs boundaries" : "Scope required"}</span>
              </div>
              <h2 id="agent-task-title" className="mt-7 font-display text-3xl font-normal tracking-[-0.02em] text-ink">Duplicate invoice retries</h2>
              <p className="mt-2 text-sm leading-6 text-ink-2">{plainLanguage ? "Illustrative bug in a fictional billing system" : "BILL-142 · base 3a42… · synthetic task"}</p>

              <div className="mt-7 rounded-card border border-line bg-surface p-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-card bg-widened/15 font-mono text-xs font-bold text-widened">#142</span>
                  <div>
                    <p className="text-sm font-semibold text-ink">{plainLanguage ? "Charge each invoice only once" : "Make retries idempotent"}</p>
                    <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">{plainLanguage ? "Requested today" : "Agent task frozen"}</p>
                  </div>
                </div>
                <div className={`mt-5 space-y-3 text-xs leading-5 ${plainLanguage ? "" : "font-mono"}`}>
                  <p className="rounded-chip bg-failed/10 px-3 py-2 text-failed line-through decoration-failed/60">{plainLanguage ? "Unrelated deploy change rejected" : ".github/workflows/deploy.yml: outside scope"}</p>
                  <p className="rounded-chip bg-included/10 px-3 py-2 text-included">{plainLanguage ? "One relevant file approved with a reason" : "src/lib/idempotency.ts: Widen approved"}</p>
                </div>
              </div>

              <div className="mt-7 border-t border-line pt-6">
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">{plainLanguage ? "Customer app" : "Target repository"}</p>
                <p className="mt-2 text-sm font-semibold text-ink">{plainLanguage ? "Northstar Checkout" : "northstar/checkout"}</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-card border border-line p-3">
                    <p className="font-display text-2xl font-normal text-ink">1,842</p>
                    <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted">{plainLanguage ? "Files checked" : "Repo files"}</p>
                  </div>
                  <div className="rounded-card border border-line p-3">
                    <p className="font-display text-2xl font-normal text-ink">1</p>
                    <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted">{plainLanguage ? "Requested fix" : "Agent Task"}</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="relative flex min-h-[560px] flex-col items-center justify-center overflow-hidden border-b border-line-2 p-5 sm:p-7 lg:border-b-0 lg:border-r" aria-label={plainLanguage ? "How Locus sets the approved file boundary" : "Guard scope visualization"}>
              <div className="migration-demo__grid absolute inset-0" aria-hidden="true" />
              <div className="absolute left-5 top-5 z-10 sm:left-7 sm:top-7">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{plainLanguage ? "Locus sets the safe area" : "Guard scope"}</p>
                <p className="mt-2 max-w-xs text-xs leading-5 text-ink-2">{plainLanguage ? "Seven files are approved for this task. The contained agent cannot read excluded Repo files, and no unapproved change is copied back." : "Only admitted paths are materialized. Seatbelt or Bubblewrap hides the original Repo and permits host writes only inside the ephemeral runtime."}</p>
              </div>

              <div className="migration-aperture relative mt-14 aspect-square w-full max-w-[440px]" aria-hidden="true">
                <svg viewBox="0 0 440 440" className="absolute inset-0 h-full w-full overflow-visible">
                  <circle cx="220" cy="220" r="186" fill="none" style={{ stroke: "var(--line-2)" }} strokeWidth="1" strokeDasharray="3 8" />
                  <circle cx="220" cy="220" r="158" fill="none" style={{ stroke: "var(--line)" }} strokeWidth="1" />
                  {graphNodes.map(([x, y, included]) => (
                    <g key={`${x}-${y}`} className={included ? "migration-graph-node migration-graph-node--included" : "migration-graph-node migration-graph-node--excluded"}>
                      <line x1={x} y1={y} x2="220" y2="220" style={{ stroke: included ? "var(--included)" : "var(--line)", strokeOpacity: included ? 0.35 : 1 }} strokeWidth="1" />
                      <rect x={x - (included ? 6 : 4)} y={y - (included ? 6 : 4)} width={included ? 12 : 8} height={included ? 12 : 8} rx="2" style={{ fill: included ? "var(--included)" : "var(--muted)" }} />
                    </g>
                  ))}
                </svg>
                <div className="migration-aperture__core absolute inset-[28%] grid place-items-center rounded-card border border-included/35 bg-surface text-center">
                  <div>
                    <p className="migration-aperture__count font-display text-5xl font-normal tracking-[-0.02em] text-ink">{stage >= 2 ? "7" : "1,842"}</p>
                    <p className="mt-1 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-included">{stage >= 2 ? plainLanguage ? "files needed" : "files admitted" : plainLanguage ? "files checked" : "files observed"}</p>
                  </div>
                </div>
              </div>

              <div className="relative z-10 mt-4 grid w-full max-w-md grid-cols-3 gap-px overflow-hidden rounded-card border border-line bg-line-2 text-center">
                <div className="bg-surface p-3"><p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">{plainLanguage ? "Needed" : "Admitted"}</p><p className="mt-1 text-sm font-semibold text-included">{stage >= 2 ? "7" : "·"}</p></div>
                <div className="bg-surface p-3"><p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">{plainLanguage ? "Untouched" : "Excluded"}</p><p className="mt-1 text-sm font-semibold text-ink">{stage >= 2 ? "1,835" : "·"}</p></div>
                <div className="bg-surface p-3"><p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">{plainLanguage ? "Extra approved" : "Widens"}</p><p className="mt-1 text-sm font-semibold text-ink">{stage >= 3 ? "1" : stage >= 2 ? "0" : "·"}</p></div>
              </div>
            </section>

            <section className="relative flex flex-col p-5 sm:p-7" aria-labelledby="proposal-title">
              <div className="flex items-center justify-between gap-3">
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{plainLanguage ? "Merge decision" : "Exact candidate"}</p>
                <span className={`rounded-chip border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.08em] ${stage >= 4 ? "border-included/30 bg-included/10 text-included" : "border-line-2 text-muted"}`}>
                  {stage >= 4 ? plainLanguage ? "Ready for review" : "Signature verified" : "Waiting"}
                </span>
              </div>
              <h2 id="proposal-title" className="mt-7 font-display text-3xl font-normal tracking-[-0.02em] text-ink">{plainLanguage ? "Proof receipt" : "Guard receipt"}</h2>
              <p className="mt-2 text-sm leading-6 text-ink-2">{plainLanguage ? "The exact fix, approved files, automated checks, and AI-provider usage reports stay connected." : "Manifest hash, working-tree content hash, Check output digests, provider-reported usage, and Review state, not task correctness."}</p>

              <div aria-hidden={stage < 3} className={`migration-diff mt-6 overflow-hidden rounded-card border border-line bg-canvas transition ${stage >= 3 ? "migration-diff--visible" : ""}`}>
                <div className="migration-reveal__inner">
                  {plainLanguage ? (
                    <div className="p-4">
                      <div className="migration-diff__line migration-diff__line--add rounded-card border border-included/15 p-4" style={{ transitionDelay: "55ms" }}>
                        <p className="text-sm font-semibold text-ink">One retry file updated</p>
                        <p className="mt-2 text-xs leading-5 text-ink-2">The fix prevents the same invoice from being charged twice.</p>
                      </div>
                      <div className="migration-diff__line migration-diff__line--context mt-3 flex items-center justify-between rounded-card border border-line px-4 py-3" style={{ transitionDelay: "165ms" }}>
                        <span className="text-xs text-ink-2">Unapproved candidate changes</span>
                        <span className="text-xs font-semibold text-included">Rejected before merge</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between border-b border-line px-4 py-3">
                        <p className="font-mono text-[11px] text-ink">src/lib/idempotency.ts</p>
                        <p className="font-mono text-[11px] text-muted">+4 −1</p>
                      </div>
                      <div className="overflow-x-auto py-3 font-mono text-xs leading-6">
                        {diffLines.map((line, index) => (
                          <div key={`${line.kind}-${index}`} className={`migration-diff__line migration-diff__line--${line.kind} min-w-[440px] px-4`} style={{ transitionDelay: `${index * 55}ms` }}>
                            {line.text}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className={`migration-checks mt-5 ${stage >= 3 ? "migration-checks--visible" : ""}`}>
                <div className="migration-reveal__inner space-y-2.5">
                  {checks.map(([label, value], index) => (
                    <div aria-hidden={stage < 3} key={label} className={`migration-check flex items-center justify-between rounded-card border border-line px-3.5 py-3 ${stage >= 3 ? "migration-check--visible" : ""}`} style={{ transitionDelay: `${420 + index * 110}ms` }}>
                      <span className="font-mono text-[11px] text-ink-2">{label}</span>
                      <span className="flex items-center gap-2 font-mono text-[11px] font-semibold text-included"><span aria-hidden="true">✓</span>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div aria-hidden={stage < 4} className={`migration-review-stamp lg:mt-auto ${stage >= 4 ? "migration-review-stamp--visible" : ""}`}>
                <div className="migration-reveal__inner">
                  <div className="pt-7">
                    <div className="rounded-card border border-included/25 bg-included/[.07] p-4">
                      <div className="flex items-start gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-included font-bold text-canvas">✓</span>
                        <div>
                          <p className="text-sm font-semibold text-ink">{plainLanguage ? "Candidate stayed inside the approved boundary" : "Signed Guard Run receipt assembled"}</p>
                          <p className="mt-1 text-xs leading-5 text-ink-2">{plainLanguage ? "A person still reviews whether the fix is correct. Their signed decision is bound to this exact proposal file." : "Ed25519 signs integrity and signer possession. A human Review separately accepts or rejects the proposal hash in the same locked artifact."}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="border-t border-line-2 bg-canvas px-4 py-4 sm:px-6">
            <div className="relative h-px bg-line-2" aria-hidden="true"><div className="migration-progress absolute inset-y-0 left-0 bg-included" style={{ width: `${stage * 25}%` }} /></div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {stages.map((item, index) => {
                const itemStage = index + 1;
                const active = itemStage === stage;
                const complete = itemStage < stage;
                return (
                  <button key={item.label} type="button" onClick={() => inspect(itemStage)} className={`rounded-card px-3 py-3 text-left transition ${active ? "bg-line-2" : "hover:bg-surface"}`} aria-current={active ? "step" : undefined}>
                    <span className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ink">
                      <span className={`grid h-5 w-5 place-items-center rounded-chip border text-[11px] ${active || complete ? "border-included bg-included text-canvas" : "border-line-2 text-muted"}`}>{complete ? "✓" : itemStage}</span>
                      {item.label}
                    </span>
                    <span className="mt-2 hidden text-xs leading-4 text-muted sm:block">{item.note}</span>
                  </button>
                );
              })}
            </div>
            <p className="sr-only" aria-live="polite">{stage === 0 ? "Demo ready" : `${activeStage.label}: ${activeStage.note}`}</p>
          </div>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-2" aria-label="Demo capability boundaries">
          <div className="rounded-card border border-line-2 bg-surface p-5">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-included">{plainLanguage ? "Available today" : "Real in early access today"}</p>
            <p className="mt-3 text-sm leading-6 text-ink-2">{plainLanguage ? "The source CLI runs Codex, Claude, or another command inside a fail-closed target-Repo boundary: it cannot read excluded Repo files, cannot write elsewhere on the host, and emits an Ed25519-signed Run receipt." : `${demoCapabilitySummary(selfServeOpen)} The v0.4 source CLI binds target-Repo containment, the working-tree candidate, Check output, provider-reported usage, and immutable human Review in a signed receipt.`}</p>
          </div>
          <div className="rounded-card border border-widened/20 bg-widened/[.04] p-5">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-widened">{plainLanguage ? "What we’re proving next" : "Being validated next"}</p>
            <p className="mt-3 text-sm leading-6 text-ink-2">{plainLanguage ? "Real design-partner use, stronger disposable-machine isolation, and whether engineering teams will pay to make this their required AI merge gate." : "Linux field validation, disposable VM isolation, managed signer identity, GitHub delivery, and paid design-partner evidence."}</p>
          </div>
        </section>
      </div>
    </div>
  );
}

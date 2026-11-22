"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type FormEvent, type RefObject } from "react";

import { Mascot } from "@/components/Mascot";
import { SITE_URL } from "@/lib/config";
import {
  beats,
  cameraView,
  CHAPTERS,
  demoRun,
  DURATION,
  FORMATS,
  frameAt,
  LAYOUT,
  LIST_ROWS,
  motionAt,
  packedHead,
  POSTER,
  type Box,
  type DemoRun,
  type Frame,
} from "@/lib/demo-script";
import { loadLandingEngine } from "@/lib/landing-engine";
import { RECORDED_RESULT, RECORDED_SLICE } from "@/lib/landing-slice";
import { LANDING_REPO, MAX_TASK_LENGTH, refinedTask, refinementTerms, TRY_TASKS } from "@/lib/landing-tasks";
import { buildWorkspacePath } from "@/lib/share";

/** A length in stage pixels: the stage is drawn at 960 by 600 and sized to its frame (globals.css). */
const u = (value: number) => `calc(var(--px) * ${value})`;
const place = (box: Box): CSSProperties => ({ left: u(box.x), top: u(box.y), width: u(box.w), height: u(box.h) });
const n = (value: number) => value.toLocaleString("en-US");

const DEFAULT_RUN = demoRun(RECORDED_RESULT);
const HOST = new URL(SITE_URL).host;

/**
 * The home page's hero: the Locus workspace, playing a recorded run from a
 * pasted Repo to a Slice handed to an agent. A script (lib/demo-script.ts)
 * drives a cursor and a camera through four chapters; the caption names each
 * beat and the chapter buttons jump between them. Pause and Expand are there
 * when wanted, and it pauses itself offscreen or in a hidden tab.
 *
 * It opens on a recorded run. Under it, a reader can type any task, or pick
 * one, and watch its Slice instead: the real localizer runs in their tab, on a
 * bundled copy of the Repo, in a chunk that loads when they reach for it, and
 * the task is not sent anywhere. With reduced motion it rests on the finished
 * Slice, without a camera or cursor, until asked to play.
 */
export function ProductDemo() {
  const runRef = useRef<DemoRun>(DEFAULT_RUN);
  const [run, setRun] = useState<DemoRun>(DEFAULT_RUN);
  const [frame, setFrame] = useState<Frame>(() => frameAt(0, DEFAULT_RUN));
  const [playing, setPlaying] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [placeholder, setPlaceholder] = useState(0);
  const [pending, setPending] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("");
  const inputId = useId();

  const time = useRef(0);
  const lastKey = useRef("");
  const boost = useRef(1);
  const figureRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  const tokensRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);

  const draw = useCallback((t: number) => {
    const current = runRef.current;
    const motion = motionAt(t, current, { still: reduced });
    const view = cameraView(motion.camera, boost.current);
    const world = worldRef.current;
    if (world) {
      world.style.transform = view.zoom === 1
        ? ""
        : `scale(${view.zoom}) translate(${u(-view.left)}, ${u(-view.top)})`;
      world.style.opacity = motion.fade === 1 ? "" : String(motion.fade);
      world.dataset.moving = String(motion.camera.moving);
    }
    cursorRef.current?.style.setProperty("transform", `translate(${u(motion.cursor.x)}, ${u(motion.cursor.y)})`);
    progressRef.current?.style.setProperty("transform", `scaleX(${motion.progress})`);
    if (tokensRef.current) tokensRef.current.textContent = motion.tokens === null ? "-" : n(motion.tokens);
    barRef.current?.style.setProperty("transform", `scaleX(${motion.tokens === null ? 0 : motion.tokens / current.totalTokens})`);

    const next = frameAt(t, current);
    const key = JSON.stringify(next);
    if (key !== lastKey.current) {
      lastKey.current = key;
      setFrame(next);
    }
  }, [reduced]);

  const seek = useCallback((t: number) => {
    time.current = t;
    draw(t);
  }, [draw]);

  // Reduced motion: rest on the finished Slice, paused.
  useEffect(() => {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setReduced(true);
    setPlaying(false);
  }, []);

  useEffect(() => {
    if (reduced) seek(POSTER);
  }, [reduced, seek]);

  // Play only while on screen in a visible tab.
  useEffect(() => {
    const figure = figureRef.current;
    if (!figure || !("IntersectionObserver" in window)) {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setInView(Boolean(entry?.isIntersecting)), { threshold: 0.2 });
    observer.observe(figure);
    const onVisibility = () => setPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // A small frame gets closer shots, since the whole stage is drawn small there.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !("ResizeObserver" in window)) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect.width ?? 720;
      boost.current = width < 620 ? Math.min(1.9, 1 + (620 - width) / 300) : 1;
      draw(time.current);
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [draw, expanded]);

  const running = playing && pageVisible && (inView || expanded);

  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    let id = requestAnimationFrame(function tick(now) {
      // A slow frame must not slow the story; a long gap (a stall) skips ahead at most half a second.
      const dt = Math.min(0.5, (now - last) / 1000);
      last = now;
      let t = time.current + dt;
      if (t >= DURATION) {
        t -= DURATION;
        viewportRef.current?.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 420, easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
      }
      time.current = t;
      draw(t);
      id = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(id);
  }, [running, draw]);

  // Redraw the current moment when the frame moves into or out of the dialog.
  useEffect(() => {
    draw(time.current);
  }, [expanded, draw]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (expanded && !dialog.open) dialog.showModal();
    if (!expanded && dialog.open) dialog.close();
  }, [expanded]);

  const openExpanded = () => {
    setPlaceholder(frameRef.current?.offsetHeight ?? 0);
    setExpanded(true);
  };

  const jump = (index: number) => {
    const chapter = CHAPTERS[index];
    if (reduced) {
      seek(chapter.poster);
      return;
    }
    seek(chapter.start);
    setPlaying(true);
  };

  // Load the localizer and the Repo once a reader reaches for the task box or a chip.
  const warm = () => void loadLandingEngine().catch(() => undefined);

  const pick = async (task: string) => {
    const text = task.trim().replace(/\s+/g, " ").slice(0, MAX_TASK_LENGTH);
    if (!text || pending !== null) return;
    setPending(text);
    setDraft(text);
    try {
      const result = text === RECORDED_RESULT.task ? RECORDED_RESULT : (await loadLandingEngine()).run(text);
      const next = demoRun(result);
      runRef.current = next;
      setRun(next);
      lastKey.current = "";
      if (reduced) seek(POSTER);
      else {
        seek(4.85);
        setPlaying(true);
      }
      setStatus(next.widened
        ? `Playing "${text}": no confident match, so Locus kept all ${next.fileCount} files.`
        : `Playing "${text}": ${next.rows.length} of ${next.fileCount} files in the Slice.`);
    } catch {
      setStatus("The localizer did not load. Reload the page to try again.");
    } finally {
      setPending(null);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void pick(draft);
  };

  const label = beats(run)[frame.beat]?.label ?? "";
  const chips = run.widened ? refinementTerms(run.repositoryTerms).map((term) => ({ text: term, task: refinedTask(run.task, term) })) : TRY_TASKS.map((task) => ({ text: task, task }));

  const framed = (
    <div ref={frameRef} className="pd-frame">
      <div className="pd-chrome" aria-hidden="true">
        <span className="pd-dots"><i /><i /><i /></span>
        <span className="pd-url">{HOST}/workspace</span>
        <span className="w-[42px]" />
      </div>
      <div ref={viewportRef} className="pd-viewport">
        <div ref={worldRef} className="pd-world" data-reduced={reduced || undefined} data-running={running}>
          <Stage frame={frame} run={run} cursorRef={cursorRef} tokensRef={tokensRef} barRef={barRef} />
        </div>
      </div>
      <div className="pd-progress" aria-hidden="true"><span ref={progressRef} /></div>
      <div className="pd-caption">
        <p className="flex min-w-0 items-center gap-2">
          <span className={`pd-live ${running ? "is-live" : ""}`} aria-hidden="true" />
          <span className="truncate">{label}</span>
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" className="pd-control" onClick={() => setPlaying((value) => !value)} aria-label={playing ? "Pause the demo" : "Play the demo"}>
            {playing ? <PauseIcon /> : <PlayIcon />}
            <span>{playing ? "Pause" : "Play"}</span>
          </button>
          <button type="button" className="pd-control" onClick={() => (expanded ? setExpanded(false) : openExpanded())} aria-label={expanded ? "Close the larger demo" : "Expand the demo"}>
            {expanded ? <CloseIcon /> : <ExpandIcon />}
            <span>{expanded ? "Close" : "Expand"}</span>
          </button>
        </div>
      </div>
      <div className="pd-chapters">
        {CHAPTERS.map((chapter, index) => (
          <button
            key={chapter.n}
            type="button"
            onClick={() => jump(index)}
            aria-current={frame.chapter === index ? "step" : undefined}
            className={frame.chapter === index ? "is-active" : ""}
          >
            <span className="tabular-nums">{chapter.n}</span> {chapter.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <figure ref={figureRef} id="try" className="scroll-mt-20" aria-label={`Locus on ${RECORDED_SLICE.repo}`}>
      <p className="sr-only">
        Locus at work on {RECORDED_SLICE.repo}. It maps the Repo&rsquo;s {n(DEFAULT_RUN.fileCount)} files,
        localizes &ldquo;{DEFAULT_RUN.task}&rdquo; to {DEFAULT_RUN.rows.length} of them ({n(DEFAULT_RUN.sliceTokens)} of{" "}
        {n(DEFAULT_RUN.totalTokens)} estimated tokens), and copies them as context for a coding agent.
      </p>
      {expanded ? <div aria-hidden="true" style={{ height: placeholder }} className="rounded-[12px] border border-dashed border-line-2" /> : framed}
      <dialog ref={dialogRef} className="pd-dialog" aria-label="Locus demo" onClose={() => setExpanded(false)}>
        {expanded && framed}
      </dialog>

      <form onSubmit={submit} className="pd-ask mt-5">
        <label htmlFor={inputId} className="sr-only">A task for {RECORDED_SLICE.repo}</label>
        <input
          id={inputId}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={warm}
          maxLength={MAX_TASK_LENGTH}
          placeholder="Describe a change to taxonomy, in a sentence"
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit" disabled={pending !== null || !draft.trim()}>
          {pending !== null ? "Localizing" : "Localize"}
        </button>
      </form>
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2" onPointerEnter={warm}>
        <span className="mr-1 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted">
          {run.widened ? "No match. Refine with" : "Try a task"}
        </span>
        {chips.map((chip) => (
          <button
            key={chip.task}
            type="button"
            disabled={pending !== null}
            onClick={() => void pick(chip.task)}
            className={`pd-chip ${run.task === chip.task ? "is-current" : ""} ${pending === chip.task ? "is-pending" : ""}`}
          >
            {chip.text}
          </button>
        ))}
        {run.widened && (
          <button type="button" className="pd-chip" disabled={pending !== null} onClick={() => void pick(RECORDED_SLICE.task)}>Back to the first task</button>
        )}
      </div>
      <p className="mt-3 font-mono text-[11px] leading-5 text-muted">
        The real localizer, running in this tab on a bundled copy of{" "}
        <a href={RECORDED_SLICE.repoUrl} className="text-ink-2 underline decoration-line-2 underline-offset-2 hover:decoration-ink">{RECORDED_SLICE.repo}</a>
        : your task is not sent anywhere.{" "}
        <Link
          href={buildWorkspacePath({ repositorySpecifier: LANDING_REPO, task: "" })}
          prefetch={false}
          className="whitespace-nowrap text-ink-2 underline decoration-line-2 underline-offset-2 hover:decoration-ink"
        >
          Your own Repo <span aria-hidden="true">↗</span>
        </Link>
      </p>
      <p role="status" className="sr-only">{status}</p>
    </figure>
  );
}

// ------------------------------------------------------------------ stage

type MarkState = "hidden" | "repo" | "anchor" | "slice" | "widened" | "out";

function markState(frame: Frame, run: DemoRun, path: string): MarkState {
  if (!frame.loaded) return "hidden";
  const hop = run.hopOf[path];
  if (frame.lit < 0) return "repo";
  if (run.widened) return hop !== undefined && frame.lit >= 1 ? "widened" : "repo";
  if (hop === undefined) return frame.lit >= 1 ? "out" : "repo";
  if (hop <= frame.lit) return hop === 0 ? "anchor" : "slice";
  return "repo";
}

const marksPerRow = (count: number) => (count > 40 ? Math.max(10, Math.ceil(count / 8)) : 5);

function TaskText({ frame, run }: { frame: Frame; run: DemoRun }) {
  const text = run.task.slice(0, frame.taskTyped);
  if (!frame.termsLit || run.terms.length === 0) return <>{text}</>;
  const pattern = new RegExp(`(${run.terms.join("|")})`, "gi");
  return (
    <>
      {text.split(pattern).map((part, index) =>
        run.terms.includes(part.toLowerCase()) ? <mark key={index} className="pd-term">{part}</mark> : <span key={index}>{part}</span>,
      )}
    </>
  );
}

function Stage({
  frame,
  run,
  cursorRef,
  tokensRef,
  barRef,
}: {
  frame: Frame;
  run: DemoRun;
  cursorRef: RefObject<HTMLDivElement | null>;
  tokensRef: RefObject<HTMLSpanElement | null>;
  barRef: RefObject<HTMLSpanElement | null>;
}) {
  const marks = useMemo(() => {
    let index = 0;
    return run.columns.map((column) => ({
      label: column.label,
      perRow: marksPerRow(column.files.length),
      files: column.files.map((path) => ({ path, index: index++ })),
    }));
  }, [run.columns]);
  const tracks = marks.map(({ perRow }) => `${perRow / 5}fr`).join(" ");
  const listed = run.rows.slice(0, run.rows.length > LIST_ROWS ? LIST_ROWS - 1 : LIST_ROWS);
  const more = run.rows.length - listed.length;
  const scanning = frame.scanning;
  const repoText = RECORDED_SLICE.repo.slice(0, frame.repoTyped);

  return (
    <div className="pd-stage" aria-hidden="true">
      {/* the rail */}
      <div className="pd-rail">
        <Image src="/locus-mark.svg" width={28} height={28} alt="" className="pd-logo" />
        <span className="pd-rail-icon is-active"><MapIcon /></span>
        <span className="pd-rail-icon"><RunsIcon /></span>
        <span className="pd-rail-icon"><SlidersIcon /></span>
        <span className="pd-avatar" />
      </div>
      <div className="pd-rule" style={{ top: u(56) }} />
      <div className="pd-rule" style={{ top: u(120) }} />

      {/* Repo */}
      <div className="pd-input" data-focus={frame.repoFocus} style={place(LAYOUT.repo)}>
        <RepoIcon />
        {frame.repoTyped === 0 && !frame.repoFocus ? <span className="pd-placeholder">owner/repo or a GitHub URL</span> : <span>{repoText}</span>}
        {frame.repoFocus && <span className="pd-caret" />}
      </div>
      <div className="pd-button" data-pressed={frame.pressed === "load"} style={place(LAYOUT.load)}>Load</div>
      <p className="pd-stats" data-shown={frame.stats}>
        <span>{n(run.fileCount)} files</span>
        <span className="pd-dot-sep" />
        <span>{n(run.totalTokens)} tokens</span>
      </p>

      {/* Task */}
      <div className="pd-input pd-input--task" data-focus={frame.taskFocus} style={place(LAYOUT.task)}>
        <span className="pd-input-label">Task</span>
        {frame.taskTyped === 0 && !frame.taskFocus
          ? <span className="pd-placeholder">Describe the change, like a bug report</span>
          : <span className="pd-task-text"><span><TaskText frame={frame} run={run} /></span>{frame.taskFocus && <span className="pd-caret" />}</span>}
      </div>
      <div className="pd-button pd-button--ink" data-pressed={frame.pressed === "localize"} data-busy={scanning} style={place(LAYOUT.localize)}>
        {scanning ? "Localizing" : "Localize"}
      </div>

      {/* Repo map */}
      <section className="pd-card" style={place(LAYOUT.map)}>
        <header className="pd-card-head">
          <span className="pd-label">Repo map</span>
          {scanning ? (
            <span className="pd-status"><Mascot mood="scan" size={16} />Localizing</span>
          ) : (
            <span className="pd-legend" data-shown={frame.loaded}>
              <i data-k="anchor" />Anchor<i data-k="slice" />Slice<i data-k="out" />Left out
            </span>
          )}
        </header>
        <div className="pd-empty" data-shown={!frame.loaded}>
          <Mascot mood={frame.mapMood} size={48} />
          <p className="pd-empty-title">No Repo yet</p>
          <p className="pd-empty-note">Paste a public GitHub Repo to map it.</p>
        </div>
        <div className="pd-field" data-scanning={scanning} style={{ gridTemplateColumns: tracks }}>
          {marks.map((column) => (
            <div key={column.label}>
              <div className="pd-field-col" style={{ gridTemplateColumns: `repeat(${column.perRow}, minmax(0, 1fr))` }}>
                {column.files.map(({ path, index }) => (
                  <span key={path} className="pd-mark" data-state={markState(frame, run, path)} style={{ "--i": index } as CSSProperties} />
                ))}
              </div>
              <p className="pd-field-label" data-shown={frame.loaded}>{column.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Context */}
      <section className="pd-card" style={place(LAYOUT.context)}>
        <header className="pd-card-head">
          <span className="pd-label">Context for the agent</span>
          <span className="pd-saved" data-shown={frame.savedShown}>
            {run.widened ? "Whole Repo" : `-${run.savedPct}%`}
          </span>
        </header>
        <p className="pd-tokens">
          <span ref={tokensRef}>-</span>
          <span className="pd-tokens-of">/ {frame.stats ? n(run.totalTokens) : "-"} tokens</span>
        </p>
        <div className="pd-bar" data-lit={frame.meterLit && !run.widened}>
          <span ref={barRef} />
        </div>
        <p className="pd-note">
          {frame.meterLit
            ? run.widened
              ? `No confident Anchor, so all ${n(run.fileCount)} files stay in`
              : `${run.rows.length} files in the Slice · ${run.fileCount - run.rows.length} left out`
            : frame.loaded ? "The whole Repo, until a task narrows it" : "Load a Repo to measure it"}
        </p>
      </section>
      <div className="pd-segments" data-enabled={frame.meterLit} style={place(LAYOUT.formats)}>
        {FORMATS.map((format, index) => (
          <span
            key={format}
            data-on={(frame.claude ? index === 1 : index === 0) || undefined}
            data-pressed={frame.pressed === "claude" && index === 1}
          >
            {format}
          </span>
        ))}
      </div>
      <div className="pd-button pd-button--ink" data-enabled={frame.meterLit} data-pressed={frame.pressed === "copy"} style={place(LAYOUT.copy)}>
        {frame.copied ? <><CheckIcon />Copied</> : "Copy context"}
      </div>

      {/* The Slice */}
      <section className="pd-card" style={place(LAYOUT.list)}>
        <header className="pd-card-head">
          <span className="pd-label">{run.widened && frame.rows > 0 ? "Kept: the whole Repo" : "In the Slice"}</span>
          <span className="pd-count" data-shown={frame.rows > 0}>
            <Mascot mood={frame.listMood} size={16} />
            <span className="tabular-nums">{frame.rows > 0 ? `${run.rows.length} of ${n(run.fileCount)}` : ""}</span>
          </span>
        </header>
        <ol className="pd-rows">
          {listed.map((row, index) => (
            <li key={row.path} data-shown={index < frame.rows} style={{ "--i": index } as CSSProperties}>
              <i data-k={run.widened ? "widened" : row.hop === 0 ? "anchor" : "slice"} />
              <span className="pd-row-path">{row.short}</span>
              <span className="pd-row-why" data-match={row.reason === "match" || undefined}>{row.reason}</span>
              <span className="pd-row-tokens">{n(row.tokens)}</span>
            </li>
          ))}
          {more > 0 && (
            <li className="pd-more" data-shown={frame.rows >= listed.length}>and {more} more</li>
          )}
        </ol>
        <div className="pd-skeleton" data-shown={frame.rows === 0}>
          {[0.72, 0.56, 0.8, 0.48, 0.66, 0.52].map((width, index) => <span key={index} style={{ width: `${width * 100}%` }} />)}
          <p className="pd-empty-note">Ranked files land here, each with its reason.</p>
        </div>
      </section>

      {/* Copied */}
      <div className="pd-toast" data-shown={frame.toast} style={place(LAYOUT.toast)}>
        <Mascot mood="found" size={16} />
        <span>
          Copied {run.packed.files} files<span className="pd-toast-dim"> · ~{n(run.packed.tokens)} tokens</span>
        </span>
      </div>

      {/* The agent */}
      <div data-band="dark" className="pd-agent" data-shown={frame.agent} style={place(LAYOUT.agent)}>
        <div className="pd-agent-bar"><span className="pd-dots"><i /><i /><i /></span><span>agent · ~/taxonomy</span></div>
        <div className="pd-agent-body">
          <p className="pd-agent-hint">Any coding agent. Locus hands over context and never writes to your repository.</p>
          <div className="pd-agent-input" data-pasted={frame.pasted}>
            {frame.pasted ? (
              <pre>
                {packedHead(run).join("\n")}
                {"\n\n"}
                {run.rows.slice(0, 3).map((row) => `===== ${row.path} =====\n⋯\n`).join("")}
              </pre>
            ) : (
              <p className="pd-placeholder">Ask the agent<span className="pd-caret" /></p>
            )}
          </div>
          <p className="pd-agent-chip" data-shown={frame.pasted}>
            Pasted context · {run.packed.files} files · ~{n(run.packed.tokens)} tokens
          </p>
        </div>
      </div>

      <span className="pd-keycap" data-shown={frame.keycap} style={{ left: u(748), top: u(386) }}>⌘ V</span>

      {frame.ripple && (
        <span key={frame.ripple.id} className="pd-ripple" style={{ left: u(frame.ripple.x), top: u(frame.ripple.y) }} />
      )}
      <div ref={cursorRef} className="pd-cursor" data-down={frame.pressed !== null}>
        <svg viewBox="0 0 16 20" aria-hidden="true">
          <path d="M1 1v15.5l4.2-4 2.9 6.6 2.6-1.1-2.9-6.5H14z" />
        </svg>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ icons

function PauseIcon() {
  return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.5v9M11 3.5v9" /></svg>;
}
function PlayIcon() {
  return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.2v9.6L12.5 8z" /></svg>;
}
function ExpandIcon() {
  return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5 9 7M2.5 13.5 7 9" /></svg>;
}
function CloseIcon() {
  return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 3.5 9 9M12.5 3.5l-9 9" /></svg>;
}
function CheckIcon() {
  return <svg viewBox="0 0 16 16" aria-hidden="true" className="pd-check"><path d="m3 8.5 3.2 3L13 4.5" /></svg>;
}
function RepoIcon() {
  return <svg viewBox="0 0 16 16" aria-hidden="true" className="pd-icon"><path d="M3.5 2.5h8a1 1 0 0 1 1 1v9h-8.5a1.5 1.5 0 0 1 0-3h8.5M5.5 5.5h4" /></svg>;
}
function MapIcon() {
  return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 2.5h4.5v4.5h-4.5zM9 2.5h4.5v4.5H9zM2.5 9h4.5v4.5h-4.5zM9 9h4.5v4.5H9z" /></svg>;
}
function RunsIcon() {
  return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 3v10l8.5-5z" /></svg>;
}
function SlidersIcon() {
  return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 4.5h11M2.5 11.5h11M5.5 2.5v4M10.5 9.5v4" /></svg>;
}

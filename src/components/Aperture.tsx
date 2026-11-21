"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { FileField, markColumns } from "@/components/FileField";
import { FilePanel } from "@/components/FilePanel";
import { loadLandingRepo } from "@/lib/landing-repo";
import { loadRecordedRuns } from "@/lib/landing-runs";
import { apertureColumns, RECORDED_RESULT, RECORDED_SLICE } from "@/lib/landing-slice";
import { LANDING_REPO, MAX_TASK_LENGTH, refinedTask, refinementTerms, SELF_PLAY, TRY_TASKS } from "@/lib/landing-tasks";
import { buildWorkspacePath } from "@/lib/share";
import type { RepoData } from "@/lib/types";

const FOLDERS = apertureColumns(RECORDED_SLICE.files);
const FILE_COUNT = RECORDED_SLICE.files.length;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The Slice aperture: recorded runs of the real localizer on the bundled copy
 * of shadcn-ui/taxonomy, replayed in the real FilePanel. The localizer itself
 * stays off the page (landing-tasks.ts): a task outside the record is handed
 * to the workspace, which localizes it on the live Repo.
 *
 * The server renders the first recorded run, so the figure is complete without
 * JavaScript. The first time it comes into view it plays by itself: it types a
 * task and replays its Slice, then a second one. Touching the figure, or
 * scrolling away, ends the self-play for good and it is the visitor's. With
 * reduced motion there is no self-play: the recorded Slice shows at once and
 * the input is ready.
 */
export function Aperture() {
  const figureRef = useRef<HTMLElement>(null);
  const endSelfPlay = useRef<(() => void) | null>(null);
  const latestRun = useRef(0);
  const justFocused = useRef(false);
  const [task, setTask] = useState<string>(RECORDED_SLICE.task);
  const [result, setResult] = useState(RECORDED_RESULT);
  const [repo, setRepo] = useState<RepoData | null>(null);
  const [hasReplayed, setHasReplayed] = useState(false);
  const [handoff, setHandoff] = useState<string | null>(null);
  const [isClosed, setIsClosed] = useState(false);
  const [isVisitors, setIsVisitors] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const show = useCallback(async (text: string) => {
    // Only the newest request may land: a visitor can submit while the
    // self-play's replay is still between its awaits.
    const run = ++latestRun.current;
    setError(null);
    setHandoff(null);
    setSelected(null);
    try {
      const recorded = (await loadRecordedRuns())(text);
      if (run !== latestRun.current) return;
      if (!recorded) {
        setHandoff(text);
        return;
      }
      setIsClosed(false);
      await sleep(60); // let the covers paint before they lift again
      if (run !== latestRun.current) return;
      setResult(recorded);
      setHasReplayed(true);
    } catch {
      if (run !== latestRun.current) return;
      setError("The recorded runs did not load, so this is still the first one. Reload the page to try again.");
    }
    setIsClosed(true);
  }, []);

  useEffect(() => {
    const figure = figureRef.current;
    if (!figure || !("IntersectionObserver" in window)) return;
    let hasStarted = false;
    let hasEnded = false;
    let settledTask: string = RECORDED_SLICE.task;

    const end = () => {
      hasEnded = true;
      endSelfPlay.current = null;
      setIsVisitors(true);
    };
    endSelfPlay.current = end;

    const play = async () => {
      for (const [index, text] of SELF_PLAY.entries()) {
        setTask("");
        await sleep(index === 0 ? 500 : 250);
        for (let typed = 1; typed <= text.length; typed += 1) {
          if (hasEnded) return;
          setTask(text.slice(0, typed));
          // Uneven on purpose: phrases, not a metronome.
          await sleep(text[typed - 1] === " " ? 90 : 34 + ((typed * 7) % 28));
        }
        await sleep(380);
        if (hasEnded) return;
        setIsPressed(true);
        await sleep(120);
        setIsPressed(false);
        await show(text);
        settledTask = text;
        await sleep(index === 0 ? 3400 : 2600);
        if (hasEnded) return;
      }
      end();
    };

    const preload = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      preload.disconnect();
      loadRecordedRuns().catch(() => {});
      loadLandingRepo().then(setRepo, () => {});
    }, { rootMargin: "600px" });
    preload.observe(figure);

    const inView = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      if (hasStarted) {
        if (!entry.isIntersecting && !hasEnded) {
          // Scrolled away mid-play: settle on the last finished Slice.
          end();
          setTask(settledTask);
          setIsClosed(true);
          inView.disconnect();
        }
        return;
      }
      if (!entry.isIntersecting) return;
      hasStarted = true;
      if (hasEnded || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        if (!hasEnded) end();
        setIsClosed(true);
        inView.disconnect();
        return;
      }
      void play();
    }, { threshold: 0.35 });
    inView.observe(figure);

    return () => {
      hasEnded = true;
      preload.disconnect();
      inView.disconnect();
    };
  }, [show]);

  const columns = useMemo(
    () => markColumns(FOLDERS, new Set(result.slice.map(({ path }) => path)), new Set(result.anchorPaths)),
    [result],
  );

  const takeOver = () => {
    if (!endSelfPlay.current) return;
    endSelfPlay.current();
    setIsClosed(true);
  };

  const submit = (text: string) => {
    takeOver();
    setTask(text);
    void show(text);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const text = task.trim().slice(0, MAX_TASK_LENGTH);
    if (text) submit(text);
  };

  const onSelect = (rel: string | null) => {
    setSelected(rel);
    // Opening a file before the Repo arrives still has to show its source.
    if (rel && !repo) loadLandingRepo().then(setRepo, () => {});
  };

  const stats = [
    ["Slice tokens", result.sliceTokens.toLocaleString("en-US")],
    ["Whole Repo", result.totalTokens.toLocaleString("en-US")],
    ["Widen", result.widened ? "Whole Repo" : "Not needed"],
  ];
  const summary = result.widened
    ? `No confident match. Widened to all ${FILE_COUNT} files.`
    : `${result.slice.length} of ${FILE_COUNT} files in the Slice.`;

  return (
    <figure
      ref={figureRef}
      onPointerDownCapture={takeOver}
      onFocusCapture={takeOver}
      className={`aperture ${isClosed ? "" : "is-open"} overflow-hidden rounded-card border border-line-2 bg-surface shadow-panel`}
      aria-label={`Recorded run on ${RECORDED_SLICE.repo}: ${summary}`}
    >
      <noscript>
        <style>{".aperture.is-open .aperture-mark::after,.aperture.is-open .aperture-count--repo{opacity:0}.aperture.is-open .aperture-count--slice{opacity:1}"}</style>
      </noscript>

      <div className="border-b border-line px-5 py-4">
        <div className="flex items-start justify-between gap-6">
          <p className="min-w-0 font-mono text-[11px] leading-5 text-muted">
            Recorded run on{" "}
            <a href={RECORDED_SLICE.repoUrl} className="whitespace-nowrap text-ink-2 underline decoration-line-2 underline-offset-2 hover:decoration-ink">
              {RECORDED_SLICE.repo}
            </a>
          </p>
          <p className="shrink-0 text-right">
            <span className="grid">
              <span className="aperture-count aperture-count--repo col-start-1 row-start-1 text-2xl font-semibold tracking-[-0.03em] text-ink tabular-nums">
                {FILE_COUNT}
              </span>
              <span className="aperture-count aperture-count--slice col-start-1 row-start-1 text-2xl font-semibold tracking-[-0.03em] text-ink tabular-nums">
                {result.slice.length}
                <span className="text-sm font-medium tracking-normal text-muted"> / {FILE_COUNT}</span>
              </span>
            </span>
            <span className="block font-mono text-[11px] text-muted">files</span>
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-2">
          <label htmlFor="aperture-task" className={`text-[13px] font-medium ${isVisitors ? "text-ink" : "text-muted"}`}>
            {isVisitors ? "Your turn. What should the agent change?" : "Task"}
          </label>
          <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
            <input
              id="aperture-task"
              value={task}
              maxLength={MAX_TASK_LENGTH}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => {
                setTask(event.target.value);
                setHandoff(null);
              }}
              // The box usually holds the last task: clicking in selects it, so typing
              // replaces it. The mouse-up would otherwise collapse the selection.
              onFocus={(event) => {
                event.target.select();
                justFocused.current = true;
              }}
              onMouseUp={(event) => {
                if (justFocused.current) event.preventDefault();
                justFocused.current = false;
              }}
              placeholder="Describe a change to this Repo"
              className="min-w-0 flex-1 rounded-chip border border-line-2 bg-canvas px-3 py-2.5 text-[15px] text-ink placeholder:text-muted focus:border-included focus:outline-none"
            />
            <button
              type="submit"
              disabled={!task.trim()}
              className={`shrink-0 rounded-chip bg-ink px-5 py-2.5 text-sm font-medium text-canvas transition-[background-color,transform] duration-150 hover:bg-ink/90 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 ${isPressed ? "scale-[0.97]" : ""}`}
            >
              Localize
            </button>
          </div>
        </form>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="text-[13px] text-muted">Try:</span>
          {TRY_TASKS.map((text) => (
            <button
              key={text}
              type="button"
              onClick={() => submit(text)}
              className="rounded-chip border border-line px-2 py-1 text-left text-[13px] text-ink-2 transition-colors duration-150 hover:border-line-2 hover:bg-surface-2 hover:text-ink"
            >
              {text}
            </button>
          ))}
        </div>

        {handoff && (
          <div className="mt-3 rounded-chip border border-line-2 bg-surface-2 px-3 py-2.5 text-[13px] leading-5 text-ink-2">
            <p>
              <span className="font-semibold text-ink">This figure replays recorded runs.</span> The workspace
              localizes a task of your own on the live Repo, with a free account.
            </p>
            <Link
              href={buildWorkspacePath({ repositorySpecifier: LANDING_REPO, task: handoff })}
              prefetch={false}
              className="mt-2 inline-block font-medium text-ink underline decoration-line-2 underline-offset-[5px] transition-colors hover:decoration-ink"
            >
              Localize it in the workspace <span aria-hidden="true">↗</span>
            </Link>
          </div>
        )}
        {error && <p role="alert" className="mt-3 text-[13px] text-failed">{error}</p>}
        {result.widened && (
          <div className="mt-3 rounded-chip border border-line-2 bg-surface-2 px-3 py-2.5 text-[13px] leading-5 text-ink-2">
            <p>
              <span className="font-semibold text-ink">No file matched with enough evidence,</span> so Locus kept the
              whole Repo instead of guessing a small Slice.
              {result.refinement && result.refinement.unmatchedTerms.length > 0 && (
                <> Not found: <span className="font-mono text-xs">{result.refinement.unmatchedTerms.slice(0, 6).join(", ")}</span>.</>
              )}
            </p>
            {result.refinement && result.refinement.repositoryTerms.length > 0 && (
              <p className="mt-2 flex flex-wrap items-center gap-1.5">
                <span>Words this Repo uses:</span>
                {refinementTerms(result.refinement.repositoryTerms).map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => submit(refinedTask(result.task, term))}
                    className="rounded-chip border border-line-2 bg-surface px-1.5 py-0.5 font-mono text-xs text-ink hover:border-ink/40"
                  >
                    {term}
                  </button>
                ))}
              </p>
            )}
          </div>
        )}
        <p role="status" className="sr-only">
          {handoff ? "This task is not recorded. The workspace can localize it." : hasReplayed ? summary : ""}
        </p>
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="px-5 py-5 lg:flex lg:flex-col lg:justify-center lg:border-r lg:border-line lg:px-8 lg:py-8">
          <FileField columns={columns} />
        </div>

        <div className="flex flex-col border-t border-line lg:border-t-0">
          {/* A fixed list height: a 3-file Slice and a 23-file Slice must not move the page. */}
          <div className="flex-1 [&>div]:rounded-none [&>div]:border-0 [&_pre]:h-[307px] [&_pre]:max-h-none [&_ul]:h-[340px] [&_ul]:max-h-none">
            <FilePanel result={result} repo={repo} selected={selected} onSelect={onSelect} />
          </div>
          <dl className="grid divide-y divide-line border-t border-line min-[360px]:grid-cols-3 min-[360px]:divide-x min-[360px]:divide-y-0">
            {stats.map(([label, value]) => (
              <div key={label} className="flex min-w-0 items-baseline justify-between gap-4 px-5 py-2.5 min-[360px]:block min-[360px]:px-3 min-[360px]:py-3 sm:px-5">
                <dt className="font-mono text-[11px] text-muted">{label}</dt>
                <dd className="text-sm font-semibold min-[360px]:mt-0.5 text-ink tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </figure>
  );
}

import { beforeAll, describe, expect, it } from "vitest";

import { packContext } from "@/components/TokenMeter";
import {
  beats,
  cameraView,
  CHAPTERS,
  demoRun,
  DURATION,
  frameAt,
  LAYOUT,
  LIST_ROWS,
  matchedTerms,
  motionAt,
  packedHead,
  POSTER,
  shortPath,
  STAGE,
  typedAt,
} from "@/lib/demo-script";
import { loadLandingEngine } from "@/lib/landing-engine";
import { RECORDED_RESULT, RECORDED_SLICE } from "@/lib/landing-slice";
import { refinedTask, refinementTerms, TRY_TASKS } from "@/lib/landing-tasks";
import type { LocateResult, RepoData } from "@/lib/types";

const recorded = demoRun(RECORDED_RESULT);
let repo: RepoData;
let runs: LocateResult[];
let widened: LocateResult | undefined;

// Every run the demo offers without typing: its own, each chip, and each refinement a Widen offers.
beforeAll(async () => {
  const engine = await loadLandingEngine();
  repo = engine.repo;
  runs = [RECORDED_RESULT, ...TRY_TASKS.map(engine.run)];
  widened = runs.find((run) => run.widened);
  for (const term of refinementTerms(widened?.refinement?.repositoryTerms ?? [])) runs.push(engine.run(refinedTask(widened!.task, term)));
});

describe("the home page demo's script", () => {
  it("plays the recorded Slice, in its real numbers", () => {
    expect(recorded.task).toBe(RECORDED_SLICE.task);
    expect(recorded.fileCount).toBe(RECORDED_SLICE.files.length);
    expect(recorded.rows).toHaveLength(RECORDED_SLICE.slice.length);
    expect(recorded.sliceTokens).toBe(RECORDED_SLICE.sliceTokens);
    expect(recorded.savedPct).toBe(RECORDED_SLICE.savedPct);
    expect(recorded.columns.flatMap((column) => column.files).sort()).toEqual([...RECORDED_SLICE.files].sort());
  });

  it("hands over what Copy context in the workspace would, for every recorded run", () => {
    for (const run of runs) {
      const packed = packContext(repo, run, "claude");
      const demo = demoRun(run);
      expect(demo.packed, run.task).toEqual({ files: packed.files, tokens: packed.tokens });
      const head = packedHead(demo);
      expect(packed.text.startsWith(`${head[0]}\n${head[1]}\n`), run.task).toBe(true);
    }
  });

  it("explains each row: a match, its hops out, or kept by a Widen", () => {
    for (const run of runs.map(demoRun)) {
      for (const row of run.rows) {
        if (run.widened) expect(row.reason).toBe("kept");
        else expect(row.reason).toBe(row.hop === 0 ? "match" : row.hop === 1 ? "1 hop" : `${row.hop} hops`);
      }
    }
    expect(recorded.rows.filter((row) => row.reason === "match")).toHaveLength(RECORDED_RESULT.anchorPaths.length);
  });

  it("highlights only task words found in an Anchor path", () => {
    expect(recorded.terms.length).toBeGreaterThan(0);
    for (const term of recorded.terms) {
      expect(recorded.task.toLowerCase()).toContain(term);
      expect(RECORDED_RESULT.anchorPaths.some((path) => path.toLowerCase().includes(term))).toBe(true);
    }
    expect(matchedTerms("fix the thing", ["lib/thing.ts"])).toEqual(["thing"]);
  });

  it("shortens long paths to their last two parts", () => {
    expect(shortPath("app/(editor)/editor/[postId]/page.tsx")).toBe("…/[postId]/page.tsx");
    expect(shortPath("lib/utils.ts")).toBe("lib/utils.ts");
  });

  it("types every character by the end of its span, never before the start", () => {
    const text = RECORDED_SLICE.task;
    expect(typedAt(text, 5, 8, 4.9)).toBe(0);
    expect(typedAt(text, 5, 8, 8)).toBe(text.length);
    let previous = 0;
    for (let t = 5; t <= 8; t += 0.05) {
      const typed = typedAt(text, 5, 8, t);
      expect(typed).toBeGreaterThanOrEqual(previous);
      previous = typed;
    }
  });

  it("opens with an empty workspace and rests, at the poster frame, on a finished Slice", () => {
    const first = frameAt(0, recorded);
    expect(first).toMatchObject({ chapter: 0, beat: 0, loaded: false, repoTyped: 0, lit: -1, rows: 0, mapMood: "sleep" });

    const poster = frameAt(POSTER, recorded);
    expect(poster.chapter).toBe(2);
    expect(poster.loaded).toBe(true);
    expect(poster.taskTyped).toBe(recorded.task.length);
    expect(poster.lit).toBe(recorded.maxHop);
    expect(poster.rows).toBe(Math.min(recorded.rows.length, LIST_ROWS));
    expect(poster.savedShown).toBe(true);
    expect(poster.agent).toBe(false);
    expect(motionAt(POSTER, recorded).tokens).toBe(recorded.sliceTokens);
  });

  it("walks the chapters and beats in order, and ends handed off", () => {
    let chapter = 0;
    let beat = 0;
    for (let t = 0; t < DURATION; t += 0.1) {
      const frame = frameAt(t, recorded);
      expect(frame.chapter).toBeGreaterThanOrEqual(chapter);
      expect(frame.beat).toBeGreaterThanOrEqual(beat);
      chapter = frame.chapter;
      beat = frame.beat;
    }
    expect(chapter).toBe(CHAPTERS.length - 1);
    expect(beat).toBe(beats(recorded).length - 1);
    expect(frameAt(DURATION - 0.1, recorded)).toMatchObject({ copied: true, agent: true, pasted: true });
    expect(motionAt(DURATION, recorded).fade).toBe(0);
  });

  it("says so when a run Widens, instead of drawing a Slice it did not find", () => {
    expect(widened).toBeDefined();
    const run = demoRun(widened!);
    expect(run.repositoryTerms.length).toBeGreaterThan(0);
    expect(beats(run).some((beat) => beat.label.startsWith("Widened: all"))).toBe(true);
    expect(frameAt(POSTER, run)).toMatchObject({ termsLit: false, listMood: "look" });
  });

  it("keeps the camera inside the stage, and holds it still on request", () => {
    for (let t = 0; t <= DURATION; t += 0.25) {
      const { camera } = motionAt(t, recorded);
      for (const boost of [1, 1.4, 1.9]) {
        const view = cameraView(camera, boost);
        expect(view.left).toBeGreaterThanOrEqual(0);
        expect(view.top).toBeGreaterThanOrEqual(0);
        expect(view.left + STAGE.w / view.zoom).toBeLessThanOrEqual(STAGE.w + 1e-6);
        expect(view.top + STAGE.h / view.zoom).toBeLessThanOrEqual(STAGE.h + 1e-6);
      }
    }
    expect(motionAt(10, recorded, { still: true }).camera).toMatchObject({ zoom: 1, moving: false });
  });

  it("keeps the start of the typed task in frame on a phone", () => {
    // The "TASK" label and its rule come before the typed text.
    const textStart = LAYOUT.task.x + 60;
    for (let t = 0; t <= DURATION; t += 0.1) {
      if (!frameAt(t, recorded).taskFocus) continue;
      expect(cameraView(motionAt(t, recorded).camera, 1.9).left).toBeLessThanOrEqual(textStart);
    }
  });
});

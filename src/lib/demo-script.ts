import type { MascotMood } from "@/components/Mascot";
import { repoMapColumns, RECORDED_SLICE, type RepoMapColumn } from "@/lib/landing-slice";
import type { LocateResult } from "@/lib/types";

/**
 * The home page's product demo as a pure function of time. Given a moment in
 * the loop and the run it replays, it says everything on the stage: what is
 * typed, which marks are lit, where the cursor and the camera are. So the
 * server renders the first frame, the chapter buttons jump anywhere, and tests
 * check any moment without a clock.
 *
 * It plays any run on the bundled copy of shadcn-ui/taxonomy: the recorded one
 * (landing-slice.ts) by default, or one the localizer computes in the tab
 * (landing-engine.ts). It never imports the localizer itself, so the page's
 * first paint does not wait on it.
 */

export const STAGE = { w: 960, h: 600 } as const;

/** One loop of the demo, in seconds. */
export const DURATION = 22;

export type Box = { x: number; y: number; w: number; h: number };

/**
 * Where everything sits on the stage, in stage pixels. The stage lays itself
 * out from these, so the cursor's targets cannot drift from the controls.
 */
export const LAYOUT = {
  repo: { x: 72, y: 12, w: 312, h: 32 },
  load: { x: 392, y: 12, w: 68, h: 32 },
  task: { x: 72, y: 68, w: 752, h: 40 },
  localize: { x: 836, y: 68, w: 108, h: 40 },
  map: { x: 72, y: 136, w: 508, h: 232 },
  context: { x: 72, y: 384, w: 508, h: 200 },
  formats: { x: 92, y: 528, w: 228, h: 36 },
  copy: { x: 432, y: 528, w: 128, h: 36 },
  toast: { x: 316, y: 466, w: 244, h: 46 },
  list: { x: 596, y: 136, w: 348, h: 448 },
  agent: { x: 512, y: 112, w: 432, h: 360 },
} as const satisfies Record<string, Box>;

/** Rows the Slice list has room for; a longer Slice ends on "and N more". */
export const LIST_ROWS = 14;

export const FORMATS = ["Generic", "Claude", "Cursor"] as const;

export const CHAPTERS = [
  { n: "01", label: "Repo", start: 0, poster: 4.8 },
  { n: "02", label: "Task", start: 5, poster: 8.5 },
  { n: "03", label: "Slice", start: 9, poster: 15.2 },
  { n: "04", label: "Hand off", start: 16, poster: 20.4 },
] as const;

/** Where the demo rests when it cannot play: the finished Slice. */
export const POSTER = CHAPTERS[2].poster;

// ---------------------------------------------------------------- the run

export type DemoRow = { path: string; short: string; reason: string; tokens: number; hop: number };

export type DemoRun = {
  task: string;
  widened: boolean;
  fileCount: number;
  columns: RepoMapColumn[];
  /** Repo path to its distance from an Anchor (0 for an Anchor); files outside the Slice are absent. */
  hopOf: Record<string, number>;
  maxHop: number;
  rows: DemoRow[];
  sliceTokens: number;
  totalTokens: number;
  savedPct: number;
  /** Task words that appear in an Anchor's path. */
  terms: string[];
  /** For a Widened run: the words the Repo uses, to refine the task with. */
  repositoryTerms: string[];
  /** What Copy context would hand over: the same budget as the workspace's TokenMeter. */
  packed: { files: number; tokens: number };
};

const PACK_BUDGET = 40_000;
const STOP_WORDS = new Set(["the", "and", "for", "with", "fix", "add", "when", "from", "into", "that", "this", "update"]);

/** "app/(editor)/editor/[postId]/page.tsx" → "…/[postId]/page.tsx". */
export function shortPath(path: string): string {
  const parts = path.split("/");
  return parts.length <= 2 ? path : `…/${parts.slice(-2).join("/")}`;
}

/** The words of a task worth highlighting: those found in an Anchor's path. */
export function matchedTerms(task: string, anchorPaths: readonly string[]): string[] {
  const paths = anchorPaths.map((path) => path.toLowerCase());
  const words = task.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
  return [...new Set(words)].filter((word) => paths.some((path) => path.includes(word)));
}

export function demoRun(result: LocateResult): DemoRun {
  const anchors = new Set(result.anchorPaths);
  const hopOf: Record<string, number> = {};
  for (const file of result.slice) hopOf[file.path] = result.widened ? 0 : anchors.has(file.path) ? 0 : Math.max(1, file.dist);
  let files = 0;
  let tokens = 0;
  for (const file of result.slice) {
    if (tokens + file.tokens > PACK_BUDGET) continue;
    files += 1;
    tokens += file.tokens;
  }
  return {
    task: result.task,
    widened: result.widened,
    fileCount: RECORDED_SLICE.files.length,
    columns: repoMapColumns(RECORDED_SLICE.files),
    hopOf,
    maxHop: Math.max(0, ...Object.values(hopOf)),
    rows: result.slice.map((file) => {
      const hop = hopOf[file.path] ?? 0;
      return {
        path: file.path,
        short: shortPath(file.path),
        reason: result.widened ? "kept" : hop === 0 ? "match" : `${hop} ${hop === 1 ? "hop" : "hops"}`,
        tokens: file.tokens,
        hop,
      };
    }),
    sliceTokens: result.sliceTokens,
    totalTokens: result.totalTokens,
    savedPct: result.savedPct,
    terms: matchedTerms(result.task, result.anchorPaths),
    repositoryTerms: result.refinement?.repositoryTerms ?? [],
    packed: { files, tokens },
  };
}

/** The head Copy context writes in the Claude format (TokenMeter's packContext). */
export function packedHead(run: DemoRun): string[] {
  return [`<context task="${run.task}">`, `<!-- ${run.packed.files} file(s), ~${run.packed.tokens} tokens, localized by Locus -->`];
}

const n = (value: number) => value.toLocaleString("en-US");

/** The caption's eight beats, in this run's numbers. */
export function beats(run: DemoRun): Array<{ at: number; label: string }> {
  return [
    { at: 0, label: "Paste a public GitHub Repo" },
    { at: 3.6, label: `${n(run.fileCount)} files mapped` },
    { at: 5, label: "Describe the change in a sentence" },
    { at: 8.7, label: run.widened ? "Look for Anchors" : "Find the Anchors" },
    { at: 11, label: run.widened ? "No confident match, so no guess" : "Follow their imports out" },
    {
      at: 13.4,
      label: run.widened
        ? `Widened: all ${n(run.fileCount)} files kept`
        : `${run.rows.length} of ${n(run.fileCount)} files, ${run.savedPct}% fewer tokens`,
    },
    { at: 16, label: "Copy the Slice as context" },
    { at: 18.2, label: "Paste it into your agent" },
  ];
}

// ---------------------------------------------------------------- motion

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
/** Ken Perlin's smootherstep: still at both ends, so moves start and land softly. */
export const smoother = (x: number) => {
  const k = clamp01(x);
  return k * k * k * (k * (k * 6 - 15) + 10);
};
const easeOutCubic = (x: number) => 1 - (1 - clamp01(x)) ** 3;

type Shot = { at: number; dur: number; x: number; y: number; zoom: number };

const OVERVIEW = { x: STAGE.w / 2, y: STAGE.h / 2, zoom: 1 };

/** The camera: where it looks and how close, eased between shots. */
const SHOTS: Shot[] = [
  { at: 0.5, dur: 0.9, x: 250, y: 70, zoom: 1.7 },
  { at: 3.7, dur: 0.8, x: 330, y: 230, zoom: 1.25 },
  { at: 4.9, dur: 0.7, x: 420, y: 90, zoom: 1.5 },
  { at: 8.8, dur: 0.8, x: 326, y: 252, zoom: 1.6 },
  { at: 11.5, dur: 0.8, x: 770, y: 340, zoom: 1.35 },
  { at: 13.3, dur: 0.7, x: 326, y: 470, zoom: 1.6 },
  { at: 14.9, dur: 0.9, ...OVERVIEW },
  { at: 16, dur: 0.7, x: 330, y: 500, zoom: 1.6 },
  { at: 18.2, dur: 0.8, x: 728, y: 292, zoom: 1.3 },
  { at: 20.9, dur: 0.9, ...OVERVIEW },
];

type Move = { at: number; dur: number; x: number; y: number };

const centre = (box: Box, dx = 0) => ({ x: box.x + box.w / 2 + dx, y: box.y + box.h / 2 });
const segment = (index: number) => ({
  x: LAYOUT.formats.x + (LAYOUT.formats.w / FORMATS.length) * (index + 0.5),
  y: LAYOUT.formats.y + LAYOUT.formats.h / 2,
});

const START = { x: 880, y: 420 };

/** The cursor's path: each move eases from where the last one ended. */
const MOVES: Move[] = [
  { at: 0.6, dur: 0.8, ...centre(LAYOUT.repo, -40) },
  { at: 3.0, dur: 0.45, ...centre(LAYOUT.load) },
  { at: 4.9, dur: 0.6, ...centre(LAYOUT.task, -150) },
  { at: 8.2, dur: 0.4, ...centre(LAYOUT.localize) },
  { at: 9.0, dur: 0.8, x: 588, y: 300 },
  { at: 16.1, dur: 0.6, ...segment(1) },
  { at: 17.0, dur: 0.5, ...centre(LAYOUT.copy) },
  { at: 18.4, dur: 0.6, x: 728, y: 418 },
  { at: 20.9, dur: 0.9, ...START },
];

type Click = { at: number; target: Pressable };
export type Pressable = "repo" | "load" | "task" | "localize" | "claude" | "copy" | "agent";

const CLICKS: Click[] = [
  { at: 1.5, target: "repo" },
  { at: 3.5, target: "load" },
  { at: 5.55, target: "task" },
  { at: 8.65, target: "localize" },
  { at: 16.8, target: "claude" },
  { at: 17.6, target: "copy" },
  { at: 19.0, target: "agent" },
];
const PRESS = 0.14;

function cameraAt(t: number) {
  let from = OVERVIEW;
  let current = OVERVIEW;
  let moving = false;
  for (const shot of SHOTS) {
    if (t < shot.at) break;
    const k = smoother((t - shot.at) / shot.dur);
    if (k < 1) moving = true;
    current = { x: lerp(from.x, shot.x, k), y: lerp(from.y, shot.y, k), zoom: lerp(from.zoom, shot.zoom, k) };
    from = shot;
  }
  return { ...current, moving };
}

function cursorAt(t: number) {
  let from = START;
  let at = START;
  for (const move of MOVES) {
    if (t < move.at) break;
    const k = smoother((t - move.at) / move.dur);
    // A shallow arc, as a hand moves, rather than a ruler line.
    const dx = move.x - from.x;
    const dy = move.y - from.y;
    const bow = Math.sin(Math.PI * k) * 0.1;
    at = { x: lerp(from.x, move.x, k) - dy * bow, y: lerp(from.y, move.y, k) + dx * bow };
    from = move;
  }
  return at;
}

/** Characters of `text` typed by `t`, typed between `start` and `end` at an uneven, human pace. */
export function typedAt(text: string, start: number, end: number, t: number): number {
  if (t < start) return 0;
  if (t >= end) return text.length;
  const span = end - start;
  let count = 0;
  for (let i = 0; i < text.length; i += 1) {
    const jitter = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    if (start + (span * (i + 0.3 * Math.abs(jitter))) / text.length <= t) count = i + 1;
  }
  return count;
}

// ---------------------------------------------------------------- the scene

export type MarkLit = -1 | 0 | 1 | 2 | 3;

/** The parts of a moment that change a few times a second: drawn by React. */
export type Frame = {
  chapter: number;
  beat: number;
  repoTyped: number;
  repoFocus: boolean;
  loaded: boolean;
  stats: boolean;
  taskTyped: number;
  taskFocus: boolean;
  scanning: boolean;
  /** Marks this many hops out are lit; -1 is none yet. */
  lit: MarkLit;
  termsLit: boolean;
  rows: number;
  meterLit: boolean;
  savedShown: boolean;
  claude: boolean;
  copied: boolean;
  toast: boolean;
  agent: boolean;
  pasted: boolean;
  keycap: boolean;
  pressed: Pressable | null;
  /** The latest click, while its ripple plays. */
  ripple: { id: number; x: number; y: number } | null;
  mapMood: MascotMood;
  listMood: MascotMood;
};

/** The parts that move every frame: written straight to the page. */
export type Motion = {
  cursor: { x: number; y: number };
  camera: { x: number; y: number; zoom: number; moving: boolean };
  progress: number;
  /** Stage opacity: it fades out at the end of the loop. */
  fade: number;
  /** Tokens the context meter reads, or null before the Repo is loaded. */
  tokens: number | null;
};

const REPO_TEXT = RECORDED_SLICE.repo;

export function frameAt(t: number, run: DemoRun): Frame {
  const chapter = CHAPTERS.reduce((current, item, index) => (t >= item.start ? index : current), 0);
  const beat = beats(run).reduce((current, item, index) => (t >= item.at ? index : current), 0);
  const lastClick = CLICKS.reduce<number>((latest, click, index) => (t >= click.at ? index : latest), -1);
  const click = CLICKS[lastClick];
  const pressing = click && t < click.at + PRESS ? click.target : null;
  const rippling = click && t < click.at + 0.5;
  const rippleAt = rippling ? cursorAt(click.at) : null;

  const loaded = t >= 3.6;
  const scanStart = 8.8;
  const anchorsAt = 10.4;
  const hopAt = (hop: number) => 11 + (hop - 1) * 0.45;
  let lit: MarkLit = -1;
  if (t >= anchorsAt) lit = 0;
  for (let hop = 1; hop <= 3; hop += 1) if (t >= hopAt(hop) && (hop <= run.maxHop || run.widened)) lit = hop as MarkLit;
  if (run.widened && t >= hopAt(1)) lit = 3;

  const shownRows = Math.min(run.rows.length, LIST_ROWS);
  const rowsStart = 11.7;
  const rowsEnd = 13;
  const rows = t < rowsStart ? 0 : Math.min(shownRows, Math.floor(((t - rowsStart) / (rowsEnd - rowsStart)) * shownRows) + 1);

  return {
    chapter,
    beat,
    repoTyped: typedAt(REPO_TEXT, 1.7, 2.9, t),
    repoFocus: t >= 1.55 && t < 3.6,
    loaded,
    stats: t >= 4.2,
    taskTyped: typedAt(run.task, 5.75, 8.15, t),
    taskFocus: t >= 5.6 && t < 8.7,
    scanning: t >= scanStart && t < anchorsAt,
    lit,
    termsLit: !run.widened && t >= anchorsAt,
    rows,
    meterLit: t >= 13.5,
    savedShown: t >= 14.5,
    claude: t >= 16.8,
    copied: t >= 17.65,
    toast: t >= 17.7 && t < 19.4,
    agent: t >= 18.2,
    pasted: t >= 19.15,
    keycap: t >= 18.95 && t < 19.6,
    pressed: pressing,
    ripple: rippleAt ? { id: lastClick, ...rippleAt } : null,
    mapMood: t < 3.5 ? "sleep" : t >= scanStart && t < anchorsAt ? "scan" : "idle",
    listMood: t < 13 ? "idle" : run.widened ? "look" : "found",
  };
}

export function motionAt(t: number, run: DemoRun, { still = false }: { still?: boolean } = {}): Motion {
  const camera = still ? { ...OVERVIEW, moving: false } : cameraAt(t);
  const meterFrom = 13.5;
  const k = easeOutCubic((t - meterFrom) / 1);
  return {
    cursor: cursorAt(t),
    camera,
    progress: clamp01(t / DURATION),
    fade: t > DURATION - 0.5 ? clamp01((DURATION - t) / 0.5) : 1,
    tokens: t < 4.2 ? null : t < meterFrom ? run.totalTokens : Math.round(lerp(run.totalTokens, run.sliceTokens, k)),
  };
}

/**
 * The camera as a transform on the stage: scale about the top-left corner,
 * then the visible region's corner, kept inside the stage so no edge shows.
 * `boost` zooms further on a small screen, where the stage is drawn small.
 */
export function cameraView(camera: { x: number; y: number; zoom: number }, boost = 1) {
  const zoom = camera.zoom ** boost;
  const width = STAGE.w / zoom;
  const height = STAGE.h / zoom;
  const left = Math.min(STAGE.w - width, Math.max(0, camera.x - width / 2));
  const top = Math.min(STAGE.h - height, Math.max(0, camera.y - height / 2));
  return { zoom, left, top };
}

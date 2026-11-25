import recorded from "@/lib/landing-orbits.json";
import { RECORDED_SLICE } from "@/lib/landing-slice";

/**
 * Where every file sits in the Locus figure, as polar coordinates about its
 * centre. Polar on purpose: a mark that changes ring then swings along an arc
 * rather than sliding across the figure.
 *
 * The Anchors are in the middle, each ring is one import further out, and the
 * files left out stay on the rim in folder order. A task that Widens fills the
 * whole disc, because nothing is left out.
 */
export type Place = {
  /** Degrees, clockwise from three o'clock. */
  angle: number;
  radius: number;
  /** -1 on the rim (left out), otherwise hops from an Anchor. */
  hop: number;
  /** How far the mark itself is turned, so a ring's marks face the centre and a grid's stay square. */
  turn: number;
};

export type Localization = {
  task: string;
  widened: boolean;
  sliceTokens: number;
  totalTokens: number;
  places: Place[];
  edges: Array<{ from: number; to: number; hop: number }>;
  /** Files per ring, Anchors first. Empty when the task Widened. */
  perHop: number[];
  inSlice: number;
};

export const FILES: readonly string[] = RECORDED_SLICE.files;
export const RIM = 322;
export const RINGS = [56, 134, 204, 264] as const;

const COUNT = FILES.length;
const round = (value: number) => Math.round(value * 100) / 100;

/** Each file's own place on the rim, from twelve o'clock in folder order. */
export const rimAngle = (file: number) => round(-90 + (file * 360) / COUNT);

/** The same direction, written as the number nearest to `near`, so nothing spins the long way round. */
function nearest(angle: number, near: number): number {
  return angle + 360 * Math.round((near - angle) / 360);
}

/**
 * Hands a fixed set of points to the files in angle order, so each file takes
 * a point close to its own direction and the paths seldom cross.
 */
function assign(points: Array<{ x: number; y: number }>, square: boolean): Place[] {
  const polar = points
    .map(({ x, y }) => ({ angle: (Math.atan2(y, x) * 180) / Math.PI, radius: Math.hypot(x, y) }))
    .map((point) => ({ ...point, angle: point.angle < -90 ? point.angle + 360 : point.angle }))
    .sort((a, b) => a.angle - b.angle);
  return polar.map(({ angle, radius }, file) => {
    const turned = round(nearest(angle, rimAngle(file)));
    return { angle: turned, radius: round(radius), hop: 0, turn: square ? -turned : 0 };
  });
}

/** The whole Repo as a plain field: how an agent meets it without Locus. */
export const GRID: Place[] = (() => {
  const columns = 13;
  const pitch = 40;
  const rows = Math.ceil(COUNT / columns);
  return assign(
    FILES.map((_, i) => ({
      x: ((i % columns) - (columns - 1) / 2) * pitch,
      y: (Math.floor(i / columns) - (rows - 1) / 2) * pitch,
    })),
    true,
  );
})();

/** Widened: every file inside, packed evenly by the golden angle. */
const DISC: Place[] = assign(
  FILES.map((_, i) => {
    const angle = i * Math.PI * (3 - Math.sqrt(5));
    const radius = 25.5 * Math.sqrt(i + 0.4);
    return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
  }),
  true,
);

function rings(slice: ReadonlyArray<readonly number[]>): Place[] {
  const places: Place[] = FILES.map((_, file) => ({ angle: rimAngle(file), radius: RIM, hop: -1, turn: 0 }));
  const hops = [...new Set(slice.map(([, hop]) => hop))];
  for (const hop of hops) {
    const files = slice.filter(([, h]) => h === hop).map(([file]) => file).sort((a, b) => a - b);
    const step = 360 / files.length;
    // Turned so the ring as a whole travels as little as it can.
    const offset = files.reduce((sum, file, k) => sum + rimAngle(file) - k * step, 0) / files.length;
    files.forEach((file, k) => {
      places[file] = {
        angle: round(offset + k * step),
        radius: hop === 0 && files.length === 1 ? 0 : RINGS[Math.min(hop, RINGS.length - 1)],
        hop,
        turn: 0,
      };
    });
  }
  return places;
}

export const LOCALIZATIONS: Localization[] = recorded.map(({ task, widened, sliceTokens, totalTokens, slice, edges }) => {
  const places = widened ? DISC : rings(slice);
  const perHop: number[] = [];
  for (const [, hop] of slice) perHop[hop] = (perHop[hop] ?? 0) + 1;
  return {
    task,
    widened,
    sliceTokens,
    totalTokens,
    places,
    edges: edges.map(([from, to]) => ({ from, to, hop: Math.max(places[from].hop, places[to].hop) })),
    perHop,
    inSlice: widened ? COUNT : slice.length,
  };
});

/** A place as x and y, for the lines between marks. */
export function point({ angle, radius }: Place): { x: number; y: number } {
  const radians = (angle * Math.PI) / 180;
  return { x: round(radius * Math.cos(radians)), y: round(radius * Math.sin(radians)) };
}

/** The folders with enough files to name on the rim, at the middle of their arc. */
export const FOLDERS: Array<{ label: string; angle: number }> = (() => {
  const byFolder = new Map<string, number[]>();
  FILES.forEach((path, file) => {
    const folder = path.includes("/") ? path.slice(0, path.indexOf("/")) : "";
    byFolder.set(folder, [...(byFolder.get(folder) ?? []), file]);
  });
  return [...byFolder]
    .filter(([folder, files]) => folder && files.length >= 10)
    .map(([label, files]) => ({ label: `${label}/`, angle: rimAngle(files.reduce((a, b) => a + b, 0) / files.length) }));
})();

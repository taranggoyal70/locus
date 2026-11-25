// Generates the README's coded graphics from committed data.
//
//   node scripts/readme-assets.mjs            # write assets/readme/*.svg
//   node scripts/readme-assets.mjs --check    # fail if any SVG is stale
//   node scripts/readme-assets.mjs --capture  # re-record hero-run.json (network)
//
// The hero is an animation of one real held-out benchmark run, not an
// illustration: every mark is a source file in that snapshot, and the marks that
// light up are the files Locus returned. hero-run.json records the run, so the
// SVGs are regenerated offline and checked byte for byte. The chart reads
// benchmarks/heldout/results.json.
//
// The look is the site's, read from the site's own sources so the two cannot
// drift: colours from the tokens in src/app/globals.css, the mark from
// public/locus-mark.svg, and the display serif from src/assets/fonts. The field
// of file marks is Fig. 1's aperture (src/components/FileField.tsx): a column
// per top-level folder, Slice marks in the signal, Anchors with a hollow centre.
//
// SVG-as-image runs no script and loads nothing from outside the file, so the
// serif is embedded as a data URI and everything else is system fonts and CSS
// keyframes. Each 12-second cycle replays the story and holds its result. Every
// element's resting style is the completed frame, so reduced motion and static
// renderers preserve the readable result without travel or repeated reveals.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildGraph, loadLocalRepo, locate } from "../bin/core.mjs";
import { ensureClone, withSnapshot } from "./benchmark-heldout.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetDir = path.join(projectRoot, "assets/readme");
const heroRunPath = path.join(assetDir, "hero-run.json");
const heldoutPath = path.join(projectRoot, "benchmarks/heldout/results.json");

const HERO_CASE = { repo: "pmndrs/jotai", commit: "bc273fd" };

// --font-display's face and fallbacks in globals.css. The face is the static
// Latin instance the social card uses (src/assets/fonts/OFL.txt).
const SERIF = "Newsreader, ui-serif, 'Iowan Old Style', Charter, Georgia, serif";
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";
const SERIF_FILE = path.join(projectRoot, "src/assets/fonts/Newsreader-Display.ttf");

// The site's --ease-out.
const EASE_OUT = "cubic-bezier(.22,1,.36,1)";

const DURATION = 12; // seconds; replay, then hold the readable result

// ---------------------------------------------------------------------------
// The site's palette
// ---------------------------------------------------------------------------

/** The colour tokens declared in the first rule of globals.css whose selector is `selector`. */
function tokenRule(css, selector) {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`src/app/globals.css has no "${selector}" rule`);
  const block = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries(
    [...block.matchAll(/--([a-z\d-]+):\s*(#[\da-f]{6}|rgba?\([^)]*\))\s*;/gi)].map(([, name, value]) => [name, value]),
  );
}

const ROLES = ["canvas", "surface", "surface-2", "line", "line-2", "ink", "ink-2", "muted", "included", "included-ink", "widened", "excluded"];

/**
 * Each theme is the page's tokens plus the dark band's, composed the way the
 * cascade composes them (src/app/design-tokens.test.ts does the same): the band
 * takes its own rule over the page, and inside the dark theme it sits one step
 * deeper. The terminal is drawn on the band in both themes, as the demo is.
 */
function readThemes() {
  const css = fs.readFileSync(path.join(projectRoot, "src/app/globals.css"), "utf8");
  const light = tokenRule(css, ":root");
  const band = { ...light, ...tokenRule(css, '[data-band="dark"]') };
  const themes = {
    dark: { ...light, ...tokenRule(css, ':root[data-theme="dark"]'), band: { ...band, ...tokenRule(css, ':root[data-theme="dark"] [data-band="dark"]') } },
    light: { ...light, band },
  };
  for (const [name, theme] of Object.entries(themes)) {
    for (const palette of [theme, theme.band]) {
      const missing = ROLES.filter((role) => !palette[role]);
      if (missing.length) throw new Error(`The ${name} theme is missing --${missing.join(", --")} in src/app/globals.css`);
    }
  }
  return themes;
}

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------

function capture() {
  const protocol = JSON.parse(fs.readFileSync(path.join(projectRoot, "benchmarks/heldout/protocol.json"), "utf8"));
  const entry = protocol.repositories.find((candidate) => candidate.repo === HERO_CASE.repo);
  const heldout = JSON.parse(fs.readFileSync(heldoutPath, "utf8"));
  const recorded = heldout.results.find((result) => result.repo === HERO_CASE.repo && result.commit === HERO_CASE.commit);
  if (!entry || !recorded) throw new Error(`${HERO_CASE.repo}@${HERO_CASE.commit} is not in the held-out results`);

  const cwd = ensureClone(entry.repo, entry.head);
  const run = withSnapshot(cwd, `${HERO_CASE.commit}^`, (dir) => {
    const snapshot = loadLocalRepo(dir);
    const graph = buildGraph(snapshot);
    const located = locate(recorded.task, snapshot, graph);
    const dist = new Map(located.slice.map((file) => [file.path, file.dist]));
    const anchors = new Set(located.anchorPaths);
    return {
      files: graph.nodes.map((node) => node.path).sort().map((file) => ({
        path: file,
        role: anchors.has(file) ? "anchor" : dist.has(file) ? "closure" : "excluded",
        dist: dist.get(file) ?? null,
        fixed: recorded.expected.includes(file),
      })),
      sliceFiles: located.slice.length,
      repositoryFiles: graph.nodes.length,
      sliceTokens: located.sliceTokens,
      repositoryTokens: located.totalTokens,
      reductionPct: located.savedPct,
    };
  });
  const output = {
    note: "One case from benchmarks/heldout, re-run by scripts/readme-assets.mjs --capture. The hero animates exactly this result.",
    repo: recorded.repo,
    commit: recorded.commit,
    snapshot: recorded.snapshot,
    subject: recorded.subject,
    task: recorded.task,
    ...run,
  };
  if (output.sliceTokens !== recorded.sliceTokens || output.reductionPct !== recorded.contextReductionPct) {
    throw new Error("The captured run disagrees with benchmarks/heldout/results.json; rerun the benchmark first");
  }
  fs.mkdirSync(assetDir, { recursive: true });
  fs.writeFileSync(heroRunPath, `${JSON.stringify(output, null, 2)}\n`);
  return output;
}

// ---------------------------------------------------------------------------
// SVG helpers
// ---------------------------------------------------------------------------

function escapeXml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

/** Rounds a coordinate so the output stays short and stable. */
function n(value) {
  return Number(value.toFixed(2));
}

function pct(seconds) {
  return Number(((seconds / DURATION) * 100).toFixed(2));
}

function kiloTokens(value) {
  return `${(value / 1000).toFixed(1)}K`;
}

/**
 * Collects one keyframe rule per distinct timing, so the animation is driven by
 * keyframe percentages and never by animation-delay: a delay would leave the
 * element in its resting (final) style until it fired. All rules share one loop.
 */
class Timeline {
  constructor() {
    this.rules = new Map();
  }

  #add(body) {
    const existing = this.rules.get(body);
    if (existing) return existing;
    const name = `k${this.rules.size}`;
    this.rules.set(body, name);
    return name;
  }

  /** Hidden until `at`, then fades in and stays. */
  reveal(at, fade = 0.3) {
    return this.#add(`0%,${pct(at)}%{opacity:0}${pct(at + fade)}%,100%{opacity:1}`);
  }

  /** At `from` opacity until `at`, then eases out of sight: a cover lifting, a count leaving. */
  lift(at, fade, from = 1) {
    return this.#add(`0%,${pct(at)}%{opacity:${from};animation-timing-function:${EASE_OUT}}${pct(at + fade)}%,100%{opacity:0}`);
  }

  /** Drops to `from` at `start`, then eases back to full size at `at`: a Slice mark settling as the covers lift. */
  settle(start, at, duration, from) {
    return this.#add(
      `0%,${pct(start)}%{transform:scale(1)}${n(pct(start) + 0.01)}%,${pct(at)}%{transform:scale(${from});animation-timing-function:${EASE_OUT}}` +
      `${pct(at + duration)}%,100%{transform:scale(1)}`,
    );
  }

  /** Visible only between `start` and `end`; hidden at rest. */
  during(start, end) {
    return this.#add(`0%,${pct(start)}%{opacity:0}${n(pct(start) + 0.01)}%,${pct(end)}%{opacity:1}${n(pct(end) + 0.01)}%,100%{opacity:0}`);
  }

  /** Slides a cover right over `length` px in `steps`, which types the text beneath it. */
  type(start, end, length, steps) {
    return this.#add(
      `0%,${pct(start)}%{transform:translateX(0);animation-timing-function:steps(${steps},end)}${pct(end)}%,100%{transform:translateX(${n(length)}px)}`,
    );
  }

  draw(start, end, length) {
    return this.#add(`0%,${pct(start)}%{stroke-dashoffset:${length}}${pct(end)}%,100%{stroke-dashoffset:0}`);
  }

  css() {
    return [...this.rules].map(([body, name]) => `@keyframes ${name}{${body}}.${name}{animation:${name} ${DURATION}s linear infinite both}`).join("");
  }
}

const MARK_SVG = fs.readFileSync(path.join(projectRoot, "public/locus-mark.svg"), "utf8");

/** The site's mark (public/locus-mark.svg) with the hairline edge `.mark` gives it in globals.css. */
function brandMark(x, y, size, theme) {
  const viewBox = MARK_SVG.match(/viewBox="([^"]+)"/)[1];
  const inner = MARK_SVG.slice(MARK_SVG.indexOf(">", MARK_SVG.indexOf("<svg")) + 1, MARK_SVG.lastIndexOf("</svg>")).replace(/>\s+</g, "><").trim();
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="${viewBox}">${inner}</svg>` +
    `<rect x="${n(x - 0.5)}" y="${n(y - 0.5)}" width="${size + 1}" height="${size + 1}" rx="${n(size * 0.22 + 0.5)}" fill="none" stroke="${theme["line-2"]}"/>`;
}

let serifFace;

/** The display serif as an @font-face rule with the font inline. */
function serifFontFace() {
  serifFace ??= `@font-face{font-family:Newsreader;font-weight:400;font-style:normal;src:url(data:font/ttf;base64,${fs.readFileSync(SERIF_FILE).toString("base64")}) format("truetype")}`;
  return serifFace;
}

/** `top` laid over `bottom` at `alpha`, as the browser composites them. */
function mix(top, bottom, alpha) {
  const channels = (hex) => [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
  const [a, b] = [channels(top), channels(bottom)];
  return `#${a.map((value, index) => Math.round(value * alpha + b[index] * (1 - alpha)).toString(16).padStart(2, "0")).join("")}`;
}

function document({ width, height, title, desc, theme, body, css }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc" font-family="${SANS}">
<title id="title">${escapeXml(title)}</title>
<desc id="desc">${escapeXml(desc)}</desc>
<style>${serifFontFace()}.s{transform-box:fill-box;transform-origin:center}${css}@media (prefers-reduced-motion: reduce){*{animation:none!important}}</style>
<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="8" fill="${theme.canvas}" stroke="${theme["line-2"]}"/>
${body}
</svg>
`;
}

/** A two-line display heading, the second line muted: the site's heading grammar. */
function heading(x, y, [first, second], { size, leading, theme }) {
  const spacing = n(size * -0.02);
  return `<g font-family="${SERIF}" font-size="${size}" letter-spacing="${spacing}">` +
    `<text x="${x}" y="${y}" fill="${theme.ink}">${escapeXml(first)}</text>` +
    `<text x="${x}" y="${y + leading}" fill="${theme.muted}">${escapeXml(second)}</text></g>`;
}

/** The mark and the serif wordmark, as the site's header sets them. */
function wordmark(x, y, size, theme) {
  return brandMark(x, y, size, theme) +
    `<text x="${n(x + size * 1.3)}" y="${n(y + size * 0.76)}" font-family="${SERIF}" font-size="${n(size * 0.8)}" letter-spacing="${n(size * 0.8 * -0.02)}" fill="${theme.ink}">Locus</text>`;
}

// ---------------------------------------------------------------------------
// The field of file marks (Fig. 1's aperture)
// ---------------------------------------------------------------------------

/** FileField's grouping: the largest top-level folders, then every smaller folder and loose file as "other". */
function folderColumns(files, maxColumns = 4) {
  const byFolder = new Map();
  for (const file of files) {
    const folder = file.path.includes("/") ? file.path.slice(0, file.path.indexOf("/")) : "other";
    byFolder.set(folder, [...(byFolder.get(folder) ?? []), file]);
  }
  const ranked = [...byFolder].filter(([folder]) => folder !== "other").sort((a, b) => b[1].length - a[1].length);
  const rest = [...ranked.slice(maxColumns).flatMap(([, list]) => list), ...(byFolder.get("other") ?? [])];
  const byPath = (a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  return [
    ...ranked.slice(0, maxColumns).map(([label, list]) => ({ label, files: [...list].sort(byPath) })),
    ...(rest.length ? [{ label: "other", files: rest.sort(byPath) }] : []),
  ];
}

// FileField draws five marks a row and widens a column of more than 40. The
// README is read at about two thirds of its drawn size, so it draws three.
const PER_ROW = 3;
const marksPerRow = (count) => (count > 40 ? 2 * PER_ROW : PER_ROW);

// Geist Mono and the system monospaces set a character in about 0.6em.
const MONO_ADVANCE = 0.6;

/**
 * Lays the columns out across `width` with whole-pixel marks. A folder name
 * wider than its column widens the gap after it, so every label is printed in
 * full and clears the next one.
 */
function fieldLayout(run, width, { gap, columnGap, labelSize }) {
  const columns = folderColumns(run.files).map((column) => ({
    ...column,
    perRow: marksPerRow(column.files.length),
    labelWidth: column.label.length * labelSize * MONO_ADVANCE,
  }));
  const across = columns.reduce((sum, column) => sum + column.perRow, 0);
  const columnWidth = (column, size) => column.perRow * size + (column.perRow - 1) * gap;
  const gapAfter = (column, size) => Math.max(columnGap, column.labelWidth + labelSize - columnWidth(column, size));
  const total = (size) => columns.reduce((sum, column, index) => sum + columnWidth(column, size) + (index < columns.length - 1 ? gapAfter(column, size) : 0), 0);
  let size = Math.floor(width / across);
  while (total(size) > width) size -= 1;
  let cursor = (width - total(size)) / 2;
  for (const column of columns) {
    column.x = cursor;
    column.width = columnWidth(column, size);
    column.rows = Math.ceil(column.files.length / column.perRow);
    cursor += column.width + gapAfter(column, size);
  }
  const rows = Math.max(...columns.map((column) => column.rows));
  return { columns, size, gap, height: rows * size + (rows - 1) * gap };
}

/**
 * The aperture: every mark starts under one cover (the whole Repo, as an agent
 * sees it without Locus). After a short hold the covers lift together; the
 * Slice shows in the signal, Anchors with a hollow centre, and the rest settles
 * to Excluded. Then the file the maintainer fixed takes an ink ring. Timings
 * are Fig. 1's (globals.css): a 200ms hold, a 900ms lift, and the Slice marks
 * settling from 60% over 280ms, 700ms in.
 */
function field(run, layout, timeline, theme, { x, y, liftAt, fixAt, labelSize }) {
  const { columns, size, gap } = layout;
  const radius = n(size * 0.11);
  const marks = [];
  const covers = [];
  const rings = [];
  const settle = timeline.settle(liftAt, liftAt + 0.7, 0.28, 0.6);
  // Fig. 1's cover is --muted at 85% over each mark. Here it is that colour over
  // an Excluded mark, made opaque, so no Slice mark shows through before the lift.
  const cover = mix(theme.muted, theme.excluded, 0.85);
  for (const column of columns) {
    column.files.forEach((file, index) => {
      const mx = n(x + column.x + (index % column.perRow) * (size + gap));
      const my = n(y + Math.floor(index / column.perRow) * (size + gap));
      // Half a pixel wider all round, so the mark's anti-aliased edge cannot show past it.
      covers.push(`<rect x="${n(mx - 0.5)}" y="${n(my - 0.5)}" width="${size + 1}" height="${size + 1}" rx="${n(radius + 0.5)}"/>`);
      if (file.role === "excluded") {
        marks.push(`<rect x="${mx}" y="${my}" width="${size}" height="${size}" rx="${radius}" fill="${theme.excluded}"/>`);
      } else {
        const hollow = file.role === "anchor"
          ? `<rect x="${n(mx + size * 0.3)}" y="${n(my + size * 0.3)}" width="${n(size * 0.4)}" height="${n(size * 0.4)}" rx="${n(size * 0.05)}" fill="${theme.surface}"/>`
          : "";
        marks.push(`<g class="s ${settle}"><rect x="${mx}" y="${my}" width="${size}" height="${size}" rx="${radius}" fill="${theme.included}"/>${hollow}</g>`);
      }
      if (file.fixed) {
        const inset = Math.max(2.5, size * 0.12);
        rings.push(`<rect class="${timeline.reveal(fixAt)}" x="${n(mx - inset)}" y="${n(my - inset)}" width="${n(size + inset * 2)}" height="${n(size + inset * 2)}" rx="${n(radius + inset)}" fill="none" stroke="${theme.ink}" stroke-width="${n(Math.max(2, size * 0.08))}"/>`);
      }
    });
  }
  const labelY = n(y + layout.height + labelSize * 1.9);
  const labels = columns.map((column) => `<text x="${n(x + column.x)}" y="${labelY}">${escapeXml(column.label)}</text>`);
  return [
    marks.join("\n"),
    `<g class="${timeline.lift(liftAt + 0.2, 0.9)}" fill="${cover}" opacity="0">${covers.join("")}</g>`,
    rings.join("\n"),
    `<g font-family="${MONO}" font-size="${labelSize}" fill="${theme.muted}">${labels.join("")}</g>`,
  ].join("\n");
}

/** The Repo count gives way to the Slice count as the covers lift, as Fig. 1's does. */
function count(run, timeline, theme, { x, y, size, liftAt }) {
  const small = n(size * 0.5);
  return `<g text-anchor="end" font-weight="600" letter-spacing="${n(size * -0.03)}">` +
    `<text class="${timeline.lift(liftAt + 0.6, 0.12)}" x="${x}" y="${y}" font-size="${size}" fill="${theme.ink}" opacity="0">${run.repositoryFiles}</text>` +
    `<text class="${timeline.reveal(liftAt + 0.72, 0.18)}" x="${x}" y="${y}" font-size="${size}" fill="${theme.ink}">${run.sliceFiles}<tspan font-size="${small}" font-weight="500" letter-spacing="0" fill="${theme.muted}"> / ${run.repositoryFiles}</tspan></text>` +
    `</g><text x="${x}" y="${n(y + size * 0.62)}" text-anchor="end" font-family="${MONO}" font-size="${n(size * 0.42)}" fill="${theme.muted}">files</text>`;
}

/**
 * The legend spread across `width`: items keep their natural size and share
 * the remaining space, so the last label ends at the card's inner edge.
 */
function legend(theme, x, y, width, size, fontSize) {
  const radius = n(size * 0.11);
  const items = [
    ["Anchor", (sx) => `<rect x="${sx}" y="${n(y - size)}" width="${size}" height="${size}" rx="${radius}" fill="${theme.included}"/><rect x="${n(sx + size * 0.3)}" y="${n(y - size * 0.7)}" width="${n(size * 0.4)}" height="${n(size * 0.4)}" rx="${n(size * 0.05)}" fill="${theme.surface}"/>`],
    ["Closure", (sx) => `<rect x="${sx}" y="${n(y - size)}" width="${size}" height="${size}" rx="${radius}" fill="${theme.included}"/>`],
    ["Excluded", (sx) => `<rect x="${sx}" y="${n(y - size)}" width="${size}" height="${size}" rx="${radius}" fill="${theme.excluded}"/>`],
    ["Changed by the fix", (sx) => `<rect x="${n(sx + 1)}" y="${n(y - size + 1)}" width="${size - 2}" height="${size - 2}" rx="${radius}" fill="none" stroke="${theme.ink}" stroke-width="2"/>`],
  ];
  // System sans averages a little over half an em per character.
  const itemWidth = ([label]) => size + 8 + label.length * fontSize * 0.55;
  const spare = width - items.reduce((sum, item) => sum + itemWidth(item), 0);
  const gap = Math.max(12, spare / (items.length - 1));
  let cursor = x;
  return `<g font-size="${fontSize}" fill="${theme["ink-2"]}">` + items.map((item) => {
    const [label, swatch] = item;
    const part = swatch(n(cursor)) + `<text x="${n(cursor + size + 8)}" y="${n(y - 1)}">${label}</text>`;
    cursor += itemWidth(item) + gap;
    return part;
  }).join("") + "</g>";
}

/** The card Fig. 1 draws: what was run, the count, the field and its legend. */
function fieldCard(run, timeline, theme, { x, y, width, padding, header, caseLine, fieldGap, columnGap, labelSize, legendSize, countSize, liftAt, fixAt }) {
  const inner = width - padding * 2;
  const layout = fieldLayout(run, inner, { gap: fieldGap, columnGap, labelSize });
  const fieldY = y + header + padding;
  const ruleY = n(fieldY + layout.height + labelSize * 1.9 + padding * 0.85);
  const height = n(ruleY - y + legendSize * 2 + padding * 0.6);
  const svg = [
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="8" fill="${theme.surface}" stroke="${theme["line-2"]}"/>`,
    `<text x="${x + padding}" y="${n(y + padding + labelSize * 0.8)}" font-family="${MONO}" font-size="${labelSize}" fill="${theme.muted}">Recorded run on <tspan fill="${theme["ink-2"]}">${escapeXml(run.repo)}</tspan></text>`,
    `<text x="${x + padding}" y="${n(y + padding + labelSize * 2.6)}" font-family="${MONO}" font-size="${labelSize}" fill="${theme.muted}">${escapeXml(caseLine(run))}</text>`,
    count(run, timeline, theme, { x: x + width - padding, y: n(y + padding + countSize * 0.78), size: countSize, liftAt }),
    `<path d="M${x} ${y + header}H${x + width}" stroke="${theme.line}"/>`,
    field(run, layout, timeline, theme, { x: x + padding, y: fieldY, liftAt, fixAt, labelSize }),
    `<path d="M${x} ${ruleY}H${x + width}" stroke="${theme.line}"/>`,
    legend(theme, x + padding, n(ruleY + legendSize * 1.45 + padding * 0.2), inner, n(legendSize * 0.9), legendSize),
  ].join("\n");
  return { svg, height };
}

// ---------------------------------------------------------------------------
// The terminal
// ---------------------------------------------------------------------------

/** Splits text into lines of at most `max` characters on word boundaries. */
function wrap(text, max) {
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && `${line} ${word}`.length > max) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Wraps into as few lines as `max` allows, then evens them out, as `text-wrap: balance` does. */
function balance(text, max) {
  const count = wrap(text, max).length;
  let width = max;
  while (width > 1 && wrap(text, width - 1).length === count) width -= 1;
  return wrap(text, width);
}

const command = (run) => `$ locus locate "${run.task}"`;

function terminalHeight(run, { lineHeight, wrapAt, padding }) {
  return padding * 2 + (balance(command(run), wrapAt).length + 0.5 + 4) * lineHeight - lineHeight * 0.3;
}

/**
 * Typed command lines, then the output once the Slice has closed. It sits on
 * the dark band in both themes, the ground the site gives its demo and footer.
 */
function terminal(run, timeline, theme, { x, y, width, lineHeight, fontSize, charWidth, wrapAt, padding, typeStart, typeEnd, outputAt, fixAt }) {
  const band = theme.band;
  const commandLines = balance(command(run), wrapAt);
  const fixed = run.files.find((file) => file.fixed);
  const label = (text) => `<tspan fill="${band.muted}">${text.padEnd(8)}</tspan>`;
  const outputs = [
    `${label("Slice")}<tspan fill="${band["included-ink"]}">${run.sliceFiles} of ${run.repositoryFiles} files</tspan>`,
    `${label("Tokens")}${kiloTokens(run.sliceTokens)} of ${kiloTokens(run.repositoryTokens)} (estimated)`,
    `${label("Saved")}${run.reductionPct}% of the repository's context`,
    `${label("Fixed")}${escapeXml(fixed.path)}  in Slice ✓`,
  ];
  const height = terminalHeight(run, { lineHeight, wrapAt, padding });
  const parts = [];
  const textX = x + padding;
  let lineY = n(y + padding + lineHeight * 0.72);
  const totalChars = commandLines.reduce((sum, line) => sum + line.length, 0);
  let elapsed = typeStart;
  commandLines.forEach((line) => {
    const length = line.length * charWidth;
    const duration = ((typeEnd - typeStart) * line.length) / totalChars;
    const slide = timeline.type(elapsed, elapsed + duration, length + charWidth, line.length + 1);
    const prompt = line.startsWith("$ ") ? `<tspan fill="${band.muted}">$</tspan>${escapeXml(line.slice(1))}` : escapeXml(line);
    parts.push(
      `<text x="${textX}" y="${lineY}" textLength="${n(length)}" lengthAdjust="spacingAndGlyphs" xml:space="preserve">${prompt}</text>`,
      // Resting position is fully slid, so a static render shows the whole line.
      `<g transform="translate(${n(length + charWidth)} 0)" class="${slide}"><rect x="${textX - 2}" y="${n(lineY - fontSize)}" width="${width - padding}" height="${lineHeight}" fill="${band.canvas}"/><rect class="${timeline.during(elapsed, elapsed + duration + 0.15)}" x="${textX - 2}" y="${n(lineY - fontSize + 2)}" width="${charWidth}" height="${fontSize + 2}" fill="${band.ink}" opacity="0"/></g>`,
    );
    elapsed += duration;
    lineY = n(lineY + lineHeight);
  });
  lineY = n(lineY + lineHeight * 0.5);
  outputs.forEach((content, index) => {
    const reveal = timeline.reveal(index === 3 ? fixAt : outputAt + index * 0.2);
    parts.push(`<text class="${reveal}" x="${textX}" y="${lineY}" xml:space="preserve">${content}</text>`);
    lineY = n(lineY + lineHeight);
  });
  // The typing covers slide past the right edge; clip them to the terminal.
  const clipId = `terminal-${x}-${n(y)}`;
  return {
    svg: `<clipPath id="${clipId}"><rect x="${x + 1}" y="${n(y + 1)}" width="${width - 2}" height="${n(height - 2)}" rx="7"/></clipPath>\n` +
      `<rect x="${x}" y="${n(y)}" width="${width}" height="${n(height)}" rx="8" fill="${band.canvas}" stroke="${band["line-2"]}"/>\n` +
      `<g clip-path="url(#${clipId})" font-family="${MONO}" font-size="${fontSize}" fill="${band.ink}">\n${parts.join("\n")}\n</g>`,
    height,
  };
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

// The sequence: the task types, the covers lift onto the Slice, the counts
// land, and last the file the maintainer fixed is found inside it.
const BEATS = { typeStart: 0.5, typeEnd: 3.1, liftAt: 3.4, outputAt: 4.5, fixAt: 5.6 };

function heroText(run) {
  const fixed = run.files.find((file) => file.fixed);
  return {
    title: "Locus: find the code, keep the control",
    desc: `Animated replay of a real held-out benchmark run. Task: "${run.task}" on ${run.repo} at ${run.snapshot}. ` +
      `Each of the ${run.repositoryFiles} marks is a source file, in a column per top-level folder. Locus anchors ${run.files.filter((file) => file.role === "anchor").length} files, ` +
      `adds their dependency closure, and excludes the rest: ${run.sliceFiles} of ${run.repositoryFiles} files, ` +
      `${kiloTokens(run.sliceTokens)} of ${kiloTokens(run.repositoryTokens)} estimated tokens, ${run.reductionPct}% less context. ` +
      `The file the maintainer fixed, ${fixed.path}, is in the Slice.`,
  };
}

function heroDesktop(run, themeName) {
  const theme = THEMES[themeName];
  const timeline = new Timeline();
  const width = 1280;
  const pad = 56;
  const leftWidth = 524;
  const cardX = 620;
  const card = fieldCard(run, timeline, theme, {
    x: cardX, y: pad, width: width - pad - cardX, padding: 30, header: 104, fieldGap: 4, columnGap: 20,
    caseLine: ({ commit, snapshot }) => `held-out case ${commit} · snapshot ${snapshot}`,
    labelSize: 15, legendSize: 16, countSize: 40, ...BEATS,
  });
  const cardBottom = pad + card.height;
  const termOptions = { lineHeight: 26, fontSize: 16, charWidth: 9.6, wrapAt: 49, padding: 24 };
  const termY = cardBottom - terminalHeight(run, termOptions);
  const term = terminal(run, timeline, theme, { x: pad, y: termY, width: leftWidth, ...termOptions, ...BEATS });
  const height = n(cardBottom + 76);
  const body = [
    wordmark(pad, pad, 40, theme),
    `<text x="${pad}" y="140" font-family="${MONO}" font-size="13" letter-spacing="2" fill="${theme["included-ink"]}">01 / FIND THE WORK</text>`,
    heading(pad - 3, 206, ["Find the code.", "Keep the control."], { size: 62, leading: 64, theme }),
    `<g font-size="20" fill="${theme["ink-2"]}"><text x="${pad}" y="${n(termY - 60)}">A task, a focused Slice, and the evidence</text><text x="${pad}" y="${n(termY - 32)}">to see why each file belongs.</text></g>`,
    term.svg,
    card.svg,
    `<text x="${pad}" y="${n(height - 34)}" font-size="15" fill="${theme.muted}">Recorded from a real run. Token counts are Locus's chars/4 estimate.</text>`,
  ].join("\n");
  return document({ width, height, ...heroText(run), theme, body, css: timeline.css() });
}

function heroMobile(run, themeName) {
  const theme = THEMES[themeName];
  const timeline = new Timeline();
  const width = 720;
  const pad = 40;
  const inner = width - pad * 2;
  const cardY = 376;
  const card = fieldCard(run, timeline, theme, {
    x: pad, y: cardY, width: inner, padding: 34, header: 136, fieldGap: 5, columnGap: 24,
    caseLine: ({ commit }) => `held-out case ${commit}`,
    labelSize: 21, legendSize: 21, countSize: 56, ...BEATS,
  });
  const termOptions = { lineHeight: 36, fontSize: 21, charWidth: 12.6, wrapAt: 46, padding: 30 };
  const termY = n(cardY + card.height + 32);
  const term = terminal(run, timeline, theme, { x: pad, y: termY, width: inner, ...termOptions, ...BEATS });
  const height = n(termY + term.height + 92);
  const body = [
    wordmark(pad, 44, 56, theme),
    `<text x="${pad}" y="128" font-family="${MONO}" font-size="18" letter-spacing="2" fill="${theme["included-ink"]}">01 / FIND THE WORK</text>`,
    heading(pad - 4, 204, ["Find the code.", "Keep the control."], { size: 74, leading: 76, theme }),
    `<text x="${pad}" y="340" font-size="25" fill="${theme["ink-2"]}">A focused Slice. Every file explained.</text>`,
    card.svg,
    term.svg,
    `<text x="${pad}" y="${n(height - 42)}" font-size="20" fill="${theme.muted}">Recorded from a real run. Tokens are chars/4 estimates.</text>`,
  ].join("\n");
  return document({ width, height, ...heroText(run), theme, body, css: timeline.css() });
}

// ---------------------------------------------------------------------------
// Hosted proposal review: a workflow illustration, never a fabricated Run.
// Copy and availability come from ProposalReview, ProposalPatch and run-review.
// It deliberately carries no invented task, passing-check status or metric.
// ---------------------------------------------------------------------------

function reviewStory(themeName, mobile = false) {
  const theme = THEMES[themeName];
  const width = mobile ? 720 : 1280;
  const height = mobile ? 1340 : 650;
  const pad = mobile ? 40 : 48;
  const cardWidth = mobile ? 640 : (width - pad * 2 - 48) / 3;
  const cardHeight = mobile ? 276 : 270;
  const cards = [0, 1, 2].map((index) => ({
    x: mobile ? pad : n(pad + index * (cardWidth + 24)),
    y: mobile ? 310 + index * 322 : 264,
  }));
  const labelSize = mobile ? 19 : 13;
  const textSize = mobile ? 23 : 17;
  const titleSize = mobile ? 40 : 30;
  const inset = mobile ? 32 : 26;
  const tx = (x, y, content, size = textSize, fill = theme["ink-2"], extra = "") =>
    `<text x="${n(x)}" y="${n(y)}" font-size="${size}" fill="${fill}" ${extra}>${escapeXml(content)}</text>`;
  const css = [
    "@keyframes review-enter{0%,6%{opacity:0;transform:translateY(14px)}15%,100%{opacity:1;transform:translateY(0)}}",
    "@keyframes review-rail{0%,16%{stroke-dashoffset:1400}72%,100%{stroke-dashoffset:0}}",
    "@keyframes review-tick{0%,38%{stroke-dashoffset:40}47%,100%{stroke-dashoffset:0}}",
    "@keyframes review-tick-next{0%,48%{stroke-dashoffset:40}57%,100%{stroke-dashoffset:0}}",
    "@keyframes review-decision{0%,57%{opacity:.18}66%,100%{opacity:1}}",
    "@keyframes review-patch{0%,65%{opacity:0;transform:translateY(18px)}77%,100%{opacity:1;transform:translateY(0)}}",
    ".review-enter{animation:review-enter 12s cubic-bezier(.22,1,.36,1) infinite both}",
    ".review-rail{stroke-dasharray:1400;animation:review-rail 12s cubic-bezier(.22,1,.36,1) infinite both}",
    ".review-tick,.review-tick-next{stroke-dasharray:40;stroke-dashoffset:0;animation:review-tick 12s linear infinite both}",
    ".review-tick-next{animation-name:review-tick-next}",
    ".review-decision{animation:review-decision 12s linear infinite both}",
    ".review-patch{animation:review-patch 12s cubic-bezier(.22,1,.36,1) infinite both}",
  ].join("");
  const path = mobile
    ? `M${pad + 20} 284V${cards[2].y - 16}`
    : `M${cards[0].x + 20} 234H${n(cards[2].x + cardWidth - 20)}`;
  const rail = `<path d="${path}" fill="none" stroke="${theme.line}" stroke-width="2"/>` +
    `<path class="review-rail" d="${path}" fill="none" stroke="${theme.included}" stroke-width="2"/>`;
  const panel = (index, label, title, content) => {
    const { x, y } = cards[index];
    return `<g>${mobile ? "" : `<circle cx="${n(x + 20)}" cy="234" r="4" fill="${theme.included}"/>`}` +
      `<rect x="${x}" y="${y}" width="${n(cardWidth)}" height="${cardHeight}" rx="6" fill="${theme.surface}" stroke="${theme["line-2"]}"/>` +
      tx(x + inset, y + 34, label, labelSize, theme.muted, `font-family="${MONO}" letter-spacing="1.3"`) +
      tx(x + inset - 1, y + 79, title, titleSize, theme.ink, `font-family="${SERIF}" letter-spacing="-.6"`) +
      content(x + inset, y, cardWidth - inset * 2) + "</g>";
  };
  const proposal = panel(0, "01 / THE PROPOSAL", "Read the change.", (x, y, inner) =>
    `<g class="review-enter">` +
    `<rect x="${x}" y="${y + 106}" width="${n(inner)}" height="88" rx="4" fill="${theme.canvas}" stroke="${theme.line}"/>` +
    tx(x + 15, y + 136, "−", 23, theme.muted, `font-family="${MONO}"`) +
    `<path d="M${x + 43} ${y + 130}h${n(inner * .64)}" stroke="${theme.excluded}" stroke-width="8" stroke-linecap="round"/>` +
    tx(x + 15, y + 174, "+", 23, theme["included-ink"], `font-family="${MONO}"`) +
    `<path d="M${x + 43} ${y + 168}h${n(inner * .54)}" stroke="${theme.included}" stroke-width="8" stroke-linecap="round"/>` +
    tx(x, y + 226, "Diff + recorded check output", textSize) +
    tx(x, y + 251, "Bound to one proposal hash", mobile ? 19 : 14, theme.muted) + "</g>",
  );
  const review = panel(1, "02 / YOUR REVIEW", "Did it do the task?", (x, y, inner) => {
    const tick = (top, label, cls) =>
      `<rect x="${x}" y="${top - 19}" width="22" height="22" rx="3" fill="${theme.canvas}" stroke="${theme["line-2"]}"/>` +
      `<path class="${cls}" d="M${x + 5} ${top - 8}l5 5 8-11" fill="none" stroke="${theme["included-ink"]}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>` +
      tx(x + 35, top, label);
    return tick(y + 126, "Your first goal", "review-tick") + tick(y + 168, "Your next goal", "review-tick-next") +
      `<g class="review-decision"><rect x="${x}" y="${y + 195}" width="${n(inner)}" height="43" rx="4" fill="${theme.included}"/>` +
      tx(x + inner / 2, y + 223, "Approve change", textSize, theme.canvas, 'text-anchor="middle" font-weight="600"') + "</g>";
  });
  const patch = panel(2, "03 / YOUR COPY", "Take it with you.", (x, y, inner) =>
    `<g class="review-patch">` +
    `<path d="M${x + 2} ${y + 108}h32l12 12v49H${x + 2}zM${x + 34} ${y + 108}v13h12" fill="${theme.canvas}" stroke="${theme["line-2"]}" stroke-width="1.5"/>` +
    `<path d="M${x + 13} ${y + 139}h23m-23 10h16" fill="none" stroke="${theme.included}" stroke-width="3"/>` +
    tx(x + 60, y + 132, "locus-<run>.patch", mobile ? 24 : 16, theme.ink, `font-family="${MONO}"`) +
    tx(x + 60, y + 158, "The frozen change", mobile ? 21 : 15, theme.muted) +
    `<rect x="${x}" y="${y + 195}" width="${n(inner)}" height="43" rx="4" fill="${theme.canvas}" stroke="${theme["line-2"]}"/>` +
    tx(x + inner / 2, y + 223, "Download change  ↓", textSize, theme.ink, 'text-anchor="middle" font-weight="600"') + "</g>",
  );
  const body = [
    tx(pad, mobile ? 55 : 48, "02 / KEEP THE DECISION", mobile ? 19 : 13, theme["included-ink"], `font-family="${MONO}" letter-spacing="2"`),
    heading(pad - 2, mobile ? 146 : 116, ["The agent proposes.", "You decide."], { size: mobile ? 70 : 56, leading: mobile ? 76 : 60, theme }),
    mobile ? "" : tx(width - pad, 160, "Nothing is sent to GitHub.", 18, theme["ink-2"], 'text-anchor="end"'),
    rail, proposal, review, patch,
    tx(pad, mobile ? 1282 : 594, "Workflow illustration. No agent is executing.", mobile ? 22 : 16, theme.muted),
    tx(pad, mobile ? 1314 : 620, "You can also download a proposal to test before deciding.", mobile ? 20 : 15, theme.muted),
  ].join("\n");
  return document({
    width, height, theme, css, body,
    title: "Locus: the agent proposes, you decide",
    desc: "Illustration of the shipped hosted proposal workflow, not a recorded Run. Read the code diff and check output, review every stated goal, then approve or reject the exact proposal. Its owner can download a git-apply patch while reviewing it or after acceptance. Nothing is sent to GitHub. A rejected proposal has no download.",
  });
}

// ---------------------------------------------------------------------------
// Feature walkthroughs. Real localization/study data and explicitly illustrated
// Guard/API transitions remain separate; presentation never invents a result.
// ---------------------------------------------------------------------------

function sceneText(x, y, value, theme, { size = 18, mono = false, color = theme["ink-2"], anchor = "start" } = {}) {
  return `<text x="${n(x)}" y="${n(y)}" font-size="${size}" fill="${color}" text-anchor="${anchor}"${mono ? ` font-family="${MONO}"` : ""}>${escapeXml(value)}</text>`;
}

function sceneLines(x, y, lines, theme, options = {}) {
  const leading = options.leading ?? (options.size ?? 18) * 1.5;
  return lines.map((line, i) => sceneText(x, y + i * leading, line, theme, options)).join("");
}

function typedSceneLines(text, box, theme, timeline, mobile, { start = .5, end = 3 } = {}) {
  const size = mobile ? 23 : 19;
  const charWidth = size * .6;
  const lines = wrap(text, Math.floor(box.width / charWidth));
  const total = lines.reduce((sum, line) => sum + line.length, 0);
  let elapsed = start;
  return lines.map((line, i) => {
    const duration = (end - start) * line.length / total;
    const length = n(line.length * charWidth);
    const cls = timeline.type(elapsed, elapsed + duration, length + charWidth, line.length + 1);
    const y = n(box.y + i * size * 1.45);
    elapsed += duration;
    return sceneText(box.x, y, line, theme, { size, mono: true, color: theme.ink }) +
      `<g transform="translate(${n(length + charWidth)} 0)" class="${cls}"><rect x="${box.x - 1}" y="${y - size}" width="${box.width + 10}" height="${n(size * 1.5)}" fill="${theme.surface}"/></g>`;
  }).join("");
}

function featureFrame(themeName, mobile, spec, leftContent, rightContent) {
  const theme = THEMES[themeName];
  const timeline = new Timeline();
  const width = mobile ? 720 : 1280;
  const height = mobile ? 1010 : 570;
  const pad = mobile ? 40 : 48;
  const boxes = mobile
    ? [{ x: pad, y: 234, width: 640, height: 300 }, { x: pad, y: 582, width: 640, height: 300 }]
    : [{ x: pad, y: 198, width: 480, height: 286 }, { x: 560, y: 198, width: 672, height: 286 }];
  const panel = (box, label, content, id) => {
    const inset = mobile ? 28 : 24;
    const inner = { x: box.x + inset, y: box.y, width: box.width - inset * 2, height: box.height };
    return `<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="6" fill="${theme.surface}" stroke="${theme["line-2"]}"/>` +
      sceneText(inner.x, box.y + 29, label, theme, { size: mobile ? 18 : 13, mono: true, color: theme.muted }) +
      `<path d="M${box.x} ${box.y + 46}h${box.width}" stroke="${theme.line}"/>` +
      `<clipPath id="${id}"><rect x="${box.x + 1}" y="${box.y + 48}" width="${box.width - 2}" height="${box.height - 49}"/></clipPath>` +
      `<g clip-path="url(#${id})">${content(inner, theme, timeline, mobile)}</g>`;
  };
  const connector = mobile ? `M${pad + 20} 544v28` : "M536 342h16";
  const body = [
    sceneText(pad, mobile ? 54 : 47, spec.label, theme, { size: mobile ? 18 : 13, mono: true, color: theme["included-ink"] }),
    `<text x="${pad - 2}" y="${mobile ? 124 : 115}" font-family="${SERIF}" font-size="${mobile ? 54 : 56}" letter-spacing="-1.1" fill="${theme.ink}">${escapeXml(spec.title)}</text>`,
    sceneLines(pad, mobile ? 171 : 156, wrap(spec.subtitle, mobile ? 47 : 110), theme, { size: mobile ? 23 : 19, leading: mobile ? 32 : 28, color: theme.muted }),
    `<path class="${timeline.draw(2.5, 4, 40)}" d="${connector}" fill="none" stroke="${theme.included}" stroke-width="2.5" stroke-dasharray="40"/>`,
    panel(boxes[0], spec.leftLabel, leftContent, "feature-left"),
    panel(boxes[1], spec.rightLabel, rightContent, "feature-right"),
    sceneLines(pad, mobile ? 941 : 527, wrap(spec.caption, mobile ? 53 : 155), theme, { size: mobile ? 20 : 15, leading: 28, color: theme.muted }),
  ].join("\n");
  return document({ width, height, title: spec.title, desc: spec.desc ?? `${spec.subtitle} ${spec.caption}`, theme, body, css: timeline.css() });
}

function featureLocalize(run, themeName, mobile) {
  const selected = run.files.filter((file) => file.role !== "excluded");
  const visible = [...selected.filter((file) => file.fixed), ...selected.filter((file) => !file.fixed)].slice(0, 4);
  return featureFrame(themeName, mobile, {
    label: "WORKSPACE / RECORDED LOCALIZATION", title: "Every file has a reason.",
    subtitle: "The task becomes Anchors, dependencies and an inspectable Slice.",
    leftLabel: "01 / REPO + TASK", rightLabel: "02 / THE FOCUSED SLICE",
    caption: `Replay of ${run.repo}@${run.commit}. ${run.sliceFiles}/${run.repositoryFiles} source files; ${run.repositoryFiles - run.sliceFiles} excluded. Token estimates are chars/4.`,
  }, (box, theme, timeline, small) => [
    sceneText(box.x, box.y + 85, run.repo, theme, { size: small ? 29 : 26, mono: true, color: theme.ink }),
    sceneText(box.x, box.y + 126, "Task", theme, { size: small ? 20 : 15, color: theme.muted }),
    typedSceneLines(run.task, { ...box, y: box.y + 163 }, theme, timeline, small),
  ].join(""), (box, theme, timeline, small) => {
    const size = small ? 22 : 21;
    return visible.map((file, index) => {
      const y = box.y + 87 + index * 39;
      const short = file.path.split("/").slice(-2).join("/");
      return `<g class="${timeline.reveal(3.2 + index * .45)}">` +
        `<rect x="${box.x}" y="${y - 21}" width="5" height="27" rx="2" fill="${theme.included}"/>` +
        sceneText(box.x + 19, y, short, theme, { size, mono: true, color: theme.ink }) +
        (small ? "" : sceneText(box.x + box.width, y, file.role === "anchor" ? "Anchor" : "Closure", theme, { size: 15, anchor: "end", color: theme.muted })) + "</g>";
    }).join("") + `<g class="${timeline.reveal(5.3)}">` +
      `<path d="M${box.x} ${box.y + 231}h${box.width}" stroke="${theme.line}"/>` +
      sceneText(box.x, box.y + 266, `${run.sliceFiles} included · ${run.repositoryFiles - run.sliceFiles} excluded`, theme, { size: small ? 24 : 21, color: theme["included-ink"] }) + "</g>";
  });
}

function featureGuard(themeName, mobile) {
  const source = fs.readFileSync(path.join(projectRoot, "src/components/MigrationDemo.tsx"), "utf8");
  const nodes = [...source.matchAll(/\[(\d+), (\d+), (true|false)\]/g)].map(([, x, y, admitted]) => ({ x: Number(x), y: Number(y), admitted: admitted === "true" }));
  if (nodes.length !== 20 || nodes.filter((node) => node.admitted).length !== 7) throw new Error("The Guard illustration changed; review the README scene against MigrationDemo.tsx.");
  return featureFrame(themeName, mobile, {
    label: "LOCUS GUARD / ILLUSTRATED WORKFLOW", title: "Keep the agent in bounds.",
    subtitle: "Admit the files. Refuse unrelated changes. Bind the evidence.",
    leftLabel: "01 / THE ADMITTED SCOPE", rightLabel: "02 / THE CANDIDATE + RECEIPT",
    caption: "Illustrated Guard sequence from the fictional Northstar demo. No agent, check or signature is executing in this SVG.",
  }, (box, theme, timeline, small) => {
    const scaleX = (box.width - 24) / 440;
    return nodes.map((node, i) => {
      const x = box.x + node.x * scaleX;
      const y = box.y + 62 + node.y * .39;
      const color = node.admitted ? theme.included : theme.excluded;
      return `<rect class="${timeline.reveal(.5 + i * .04)}" x="${n(x)}" y="${n(y)}" width="19" height="19" rx="3" fill="${color}"/>`;
    }).join("") + sceneText(box.x, box.y + 256, "7 admitted · excluded paths stay out", theme, { size: small ? 23 : 20, color: theme["included-ink"] });
  }, (box, theme, timeline, small) => {
    const size = small ? 22 : 19;
    const steps = [
      [2.7, "Unrelated deploy change", "outside scope"],
      [4.1, "Frozen candidate", "diff + check evidence"],
      [5.7, "Ed25519 receipt", "binds the exact bytes"],
    ];
    return steps.map(([at, label, detail], i) => {
      const y = box.y + 86 + i * 70;
      return `<g class="${timeline.reveal(at)}">` +
        `<circle cx="${box.x + 10}" cy="${y - 7}" r="9" fill="none" stroke="${i === 0 ? theme.widened : theme.included}" stroke-width="2"/>` +
        sceneText(box.x + 34, y, label, theme, { size, color: theme.ink }) +
        sceneText(box.x + 34, y + 27, detail, theme, { size: small ? 19 : 16, color: i === 0 ? theme.widened : theme.muted }) + "</g>";
    }).join("");
  });
}

function featureEvidence(report, themeName, mobile) {
  return featureFrame(themeName, mobile, {
    label: "RELEASE 1 / COMMITTED STUDY STATE", title: "The evidence sets the limit.",
    subtitle: "The claim stays locked until every required result is valid.",
    leftLabel: "01 / THE FROZEN PROTOCOL", rightLabel: "02 / THE PUBLIC CLAIM GATE",
    caption: "Replays the committed report. The motion reveals protocol checks; it never adds submissions or manufactures study outcomes.",
  }, (box, theme, timeline, small) => {
    const lines = [
      `${report.study.caseCount} frozen tasks`,
      `${report.study.repositoryCount} public repositories`,
      `${report.study.armCount} context arms`,
      report.study.blindedReview ? "Arm-blinded human review" : "Human review",
    ];
    return lines.map((line, i) => `<g class="${timeline.reveal(.6 + i * .7)}">` +
      `<path d="M${box.x} ${box.y + 78 + i * 48}h16" stroke="${theme.included}" stroke-width="2"/>` +
      sceneText(box.x + 30, box.y + 85 + i * 48, line, theme, { size: small ? 24 : 22, color: theme.ink }) + "</g>").join("");
  }, (box, theme, timeline, small) => {
    const locked = !report.gatePassed;
    return `<g class="${timeline.reveal(3.5)}">` +
      `<rect x="${box.x}" y="${box.y + 69}" width="108" height="29" rx="4" fill="${theme.canvas}" stroke="${theme.line}"/>` +
      sceneText(box.x + 54, box.y + 90, locked ? "LOCKED" : "PASSED", theme, { size: 16, mono: true, anchor: "middle", color: locked ? theme.widened : theme["included-ink"] }) +
      `<text x="${box.x}" y="${box.y + 176}" font-family="${SERIF}" font-size="76" fill="${theme.ink}">${report.progress.validResults}<tspan fill="${theme.muted}" font-size="38"> / ${report.progress.expectedResults}</tspan></text>` +
      sceneText(box.x, box.y + 213, "valid reviewed arm results", theme, { size: small ? 24 : 21 }) +
      `<rect x="${box.x}" y="${box.y + 237}" width="${box.width}" height="6" rx="3" fill="${theme["surface-2"]}"/>` +
      (report.progress.validResults > 0 ? `<rect x="${box.x}" y="${box.y + 237}" width="${n(box.width * report.progress.validResults / report.progress.expectedResults)}" height="6" rx="3" fill="${theme.included}"/>` : "") + "</g>";
  });
}

function featureApi(run, themeName, mobile) {
  return featureFrame(themeName, mobile, {
    label: "REST API / REQUEST + RESPONSE ILLUSTRATION", title: "A Slice your tools can use.",
    subtitle: "One authenticated request. Structured context your tools can use.",
    leftLabel: "01 / POST /api/v1/locate", rightLabel: "02 / RESPONSE EXCERPT",
    caption: "Transport illustration using the recorded jotai localization. No HTTP request is sent; the response is a shortened illustration.",
  }, (box, theme, timeline, small) => {
    const size = small ? 20 : 17;
    const request = `repo: ${run.repo}\ntask: ${run.task}`;
    return sceneText(box.x, box.y + 82, "Authorization: Bearer $LOCUS_API_KEY", theme, { size: small ? 19 : 17, mono: true, color: theme.muted }) +
      typedSceneLines(request, { ...box, y: box.y + 127 }, theme, timeline, small, { start: .6, end: 3.4 }) +
      sceneText(box.x, box.y + 273, "Public Repo + task → localization", theme, { size, color: theme.muted });
  }, (box, theme, timeline, small) => `<g class="${timeline.reveal(4)}">` +
    sceneLines(box.x, box.y + 87, [
      '"slice": [',
      `  { "path": "${run.files.find((file) => file.fixed).path}" },`,
      `  … ${run.sliceFiles} files in this recorded Slice`,
      '],',
      `"tokens": { "included": ${run.sliceTokens},`,
      `            "total": ${run.repositoryTokens} }`,
    ], theme, { size: small ? 20 : 19, leading: 31, mono: true, color: theme.ink }) + "</g>");
}

function architectureScene(themeName, mobile) {
  const node = (box, theme, timeline, small, labels, start) => labels.map(([title, detail], i) => {
    const y = box.y + 76 + i * 70;
    return `<g class="${timeline.reveal(start + i * .65)}">` +
      `<circle cx="${box.x + 8}" cy="${y - 6}" r="6" fill="${theme.included}"/>` +
      (i < labels.length - 1 ? `<path d="M${box.x + 8} ${y + 6}v39" stroke="${theme.line}" stroke-width="1.5"/>` : "") +
      sceneText(box.x + 30, y, title, theme, { size: small ? 24 : 23, color: theme.ink }) +
      sceneText(box.x + 30, y + 28, detail, theme, { size: small ? 19 : 16, color: theme.muted }) + "</g>";
  }).join("");
  return featureFrame(themeName, mobile, {
    label: "ARCHITECTURE / ANIMATED MAP", title: "One localizer. Two paths.",
    subtitle: "Deterministic context selection feeds hosted Runs or your own agent.",
    leftLabel: "01 / SHARED LOCALIZER", rightLabel: "02 / CHOOSE HOW TO USE IT",
    caption: "Architecture illustration. Hosted review/patches and CLI Guard receipts are separate paths; the motion executes neither.",
  }, (box, theme, timeline, small) => node(box, theme, timeline, small, [
    ["Task + Repo + evidence", "The input stays inspectable"],
    ["Graph → Anchors → Closure", "No model calls during localization"],
    ["Slice or conservative Widen", "Every included and excluded path recorded"],
  ], .5), (box, theme, timeline, small) => node(box, theme, timeline, small, [
    ["Hosted: Workflow + Sandbox", "Frozen candidate → checks → human review"],
    ["Take the proposal as a patch", "Apply it yourself; no GitHub push"],
    ["CLI: your agent + Locus Guard", "Scope gate → signed receipt + human review"],
  ], 3.3));
}

// ---------------------------------------------------------------------------
// Held-out chart
// ---------------------------------------------------------------------------

const CHART_MOTION = "@keyframes chart-grow{0%,8%{transform:scaleX(0)}30%,100%{transform:scaleX(1)}}.chart-grow{transform-box:fill-box;transform-origin:left center;animation:chart-grow 12s cubic-bezier(.22,1,.36,1) infinite both}";

function chartGroups(summary) {
  return [
    ["Task as written", summary.localized, summary.widenedCases],
    ["Scope word removed", summary.withoutScope.localized, summary.withoutScope.widenedCases],
  ];
}

function chartBars(stats, theme) {
  return [
    ["Locus Slice", stats.fixFileRecall, theme.included],
    ["Random Slice, same size", stats.chanceFixFileRecall, theme.muted],
  ];
}

function chartText(summary) {
  return {
    title: `Fix-file recall on ${summary.cases} held-out bug fixes`,
    lead: `Localized cases from ${summary.repositories} third-party repositories Locus was never tuned on. Higher is better.`,
    note: "Recall is whether the files the maintainer changed are in the Slice, not whether an agent fixed the bug.",
    desc: `Bar chart. With the task as written, Locus's Slice contained ${(summary.localized.fixFileRecall * 100).toFixed(1)}% of fix files on ${summary.localized.cases} localized cases (${summary.widenedCases} Widened), ` +
      `against ${(summary.localized.chanceFixFileRecall * 100).toFixed(1)}% for a random Slice of the same size. With the scope word removed, ` +
      `${(summary.withoutScope.localized.fixFileRecall * 100).toFixed(1)}% against ${(summary.withoutScope.localized.chanceFixFileRecall * 100).toFixed(1)}% on ${summary.withoutScope.localized.cases} localized cases (${summary.withoutScope.widenedCases} Widened).`,
  };
}

const percent = (value) => `${(value * 100).toFixed(1)}%`;

function heldoutChart(heldout, themeName) {
  const theme = THEMES[themeName];
  const { summary } = heldout;
  const text = chartText(summary);
  const width = 1280;
  const height = 452;
  const barX = 360;
  const barWidth = 560;
  const parts = [
    `<text x="64" y="86" font-family="${SERIF}" font-size="40" letter-spacing="-0.8" fill="${theme.ink}">${escapeXml(text.title)}</text>`,
    `<text x="64" y="122" font-size="18" fill="${theme.muted}">${escapeXml(text.lead)}</text>`,
  ];
  let y = 172;
  for (const [label, stats, widened] of chartGroups(summary)) {
    parts.push(`<text x="64" y="${y + 20}" font-size="19" font-weight="600" fill="${theme.ink}">${label}</text>`);
    parts.push(`<text x="64" y="${y + 46}" font-size="16" fill="${theme.muted}">${stats.cases} localized, <tspan fill="${theme.widened}">${widened} Widened</tspan></text>`);
    parts.push(`<text x="64" y="${y + 70}" font-size="16" fill="${theme.muted}">${stats.medianContextReductionPct}% median context saved</text>`);
    chartBars(stats, theme).forEach(([name, value, color], index) => {
      const barY = y + index * 36;
      const length = Math.max(4, value * barWidth);
      parts.push(`<rect x="${barX}" y="${barY}" width="${barWidth}" height="24" rx="4" fill="${theme["surface-2"]}"/>`);
      parts.push(`<rect class="chart-grow" x="${barX}" y="${barY}" width="${n(length)}" height="24" rx="4" fill="${color}"/>`);
      parts.push(`<text x="${barX + barWidth + 18}" y="${barY + 18}" font-size="17" font-weight="600" fill="${theme.ink}">${percent(value)}</text>`);
      parts.push(`<text x="${barX + barWidth + 98}" y="${barY + 18}" font-size="16" fill="${theme.muted}">${name}</text>`);
    });
    y += 116;
  }
  parts.push(`<text x="64" y="${height - 42}" font-size="15" fill="${theme.muted}">Source: <tspan font-family="${MONO}">benchmarks/heldout/results.json</tspan> (${escapeXml(summary.protocolVersion)}). ${escapeXml(text.note)}</text>`);
  return document({ width, height, title: "Held-out fix-file recall", desc: text.desc, theme, body: parts.join("\n"), css: CHART_MOTION });
}

/** The same chart stacked for a phone: each bar takes the full width, its name and value above it. */
function heldoutChartMobile(heldout, themeName) {
  const theme = THEMES[themeName];
  const { summary } = heldout;
  const text = chartText(summary);
  const width = 720;
  const pad = 40;
  const inner = width - pad * 2;
  const parts = [];
  let y = 96;
  for (const line of balance(text.title, 24)) {
    parts.push(`<text x="${pad - 2}" y="${y}" font-family="${SERIF}" font-size="50" letter-spacing="-1" fill="${theme.ink}">${escapeXml(line)}</text>`);
    y += 54;
  }
  y += 4;
  for (const line of wrap(text.lead, 48)) {
    parts.push(`<text x="${pad}" y="${y}" font-size="24" fill="${theme.muted}">${escapeXml(line)}</text>`);
    y += 34;
  }
  y += 34;
  for (const [label, stats, widened] of chartGroups(summary)) {
    parts.push(`<path d="M${pad} ${y}H${width - pad}" stroke="${theme.line}"/>`);
    y += 48;
    parts.push(`<text x="${pad}" y="${y}" font-size="27" font-weight="600" fill="${theme.ink}">${label}</text>`);
    y += 36;
    parts.push(`<text x="${pad}" y="${y}" font-size="22" fill="${theme.muted}">${stats.cases} localized, <tspan fill="${theme.widened}">${widened} Widened</tspan>, ${stats.medianContextReductionPct}% median context saved</text>`);
    y += 30;
    for (const [name, value, color] of chartBars(stats, theme)) {
      y += 34;
      parts.push(`<text x="${pad}" y="${y}" font-size="22" fill="${theme.muted}">${name}</text>`);
      parts.push(`<text x="${width - pad}" y="${y}" text-anchor="end" font-size="24" font-weight="600" fill="${theme.ink}">${percent(value)}</text>`);
      y += 14;
      parts.push(`<rect x="${pad}" y="${y}" width="${inner}" height="28" rx="4" fill="${theme["surface-2"]}"/>`);
      parts.push(`<rect class="chart-grow" x="${pad}" y="${y}" width="${n(Math.max(4, value * inner))}" height="28" rx="4" fill="${color}"/>`);
      y += 28;
    }
    y += 40;
  }
  y += 6;
  parts.push(`<text x="${pad}" y="${y}" font-size="20" fill="${theme.muted}">Source: <tspan font-family="${MONO}">benchmarks/heldout/results.json</tspan></text>`);
  for (const line of wrap(`(${summary.protocolVersion}). ${text.note}`, 54)) {
    y += 30;
    parts.push(`<text x="${pad}" y="${y}" font-size="20" fill="${theme.muted}">${escapeXml(line)}</text>`);
  }
  const height = y + 56;
  return document({ width, height, title: "Held-out fix-file recall", desc: text.desc, theme, body: parts.join("\n"), css: CHART_MOTION });
}

// ---------------------------------------------------------------------------

const THEMES = readThemes();

function render() {
  const run = JSON.parse(fs.readFileSync(heroRunPath, "utf8"));
  const heldout = JSON.parse(fs.readFileSync(heldoutPath, "utf8"));
  const report = JSON.parse(fs.readFileSync(path.join(projectRoot, "benchmarks/release1/public-report.json"), "utf8"));
  const outputs = {};
  for (const themeName of Object.keys(THEMES)) {
    outputs[`hero-${themeName}.svg`] = heroDesktop(run, themeName);
    outputs[`hero-mobile-${themeName}.svg`] = heroMobile(run, themeName);
    outputs[`review-${themeName}.svg`] = reviewStory(themeName);
    outputs[`review-mobile-${themeName}.svg`] = reviewStory(themeName, true);
    outputs[`heldout-${themeName}.svg`] = heldoutChart(heldout, themeName);
    outputs[`heldout-mobile-${themeName}.svg`] = heldoutChartMobile(heldout, themeName);
    for (const mobile of [false, true]) {
      const suffix = `${mobile ? "mobile-" : ""}${themeName}.svg`;
      outputs[`feature-localize-${suffix}`] = featureLocalize(run, themeName, mobile);
      outputs[`feature-guard-${suffix}`] = featureGuard(themeName, mobile);
      outputs[`feature-evidence-${suffix}`] = featureEvidence(report, themeName, mobile);
      outputs[`feature-api-${suffix}`] = featureApi(run, themeName, mobile);
      outputs[`architecture-${suffix}`] = architectureScene(themeName, mobile);
    }
  }
  return outputs;
}

function main() {
  if (process.argv.includes("--capture")) capture();
  const outputs = render();
  if (process.argv.includes("--check")) {
    const stale = Object.entries(outputs).filter(([name, content]) => {
      const file = path.join(assetDir, name);
      return !fs.existsSync(file) || fs.readFileSync(file, "utf8") !== content;
    });
    if (stale.length) {
      console.error(`Stale README assets: ${stale.map(([name]) => name).join(", ")}. Run node scripts/readme-assets.mjs.`);
      process.exitCode = 1;
      return;
    }
    console.log(`${Object.keys(outputs).length} README assets are current.`);
    return;
  }
  fs.mkdirSync(assetDir, { recursive: true });
  for (const [name, content] of Object.entries(outputs)) fs.writeFileSync(path.join(assetDir, name), content);
  console.log(`Wrote ${Object.keys(outputs).length} README assets to ${path.relative(projectRoot, assetDir)}.`);
}

main();

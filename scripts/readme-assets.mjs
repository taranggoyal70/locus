// Generates the README's coded graphics from committed data.
//
//   node scripts/readme-assets.mjs            # write assets/readme/*.svg
//   node scripts/readme-assets.mjs --check    # fail if any SVG is stale
//   node scripts/readme-assets.mjs --capture  # re-record hero-run.json (network)
//
// The hero is an animation of one real held-out benchmark run, not an
// illustration: every cell is a source file in that snapshot, and the cells that
// light up are the files Locus returned. hero-run.json records the run, so the
// SVGs are regenerated offline and checked byte for byte. The chart reads
// benchmarks/heldout/results.json.
//
// SVG-as-image cannot load fonts or run scripts, so everything is system fonts
// and CSS keyframes. Every element's resting style is its final frame, so a
// reader with reduced motion, or a renderer without animation, sees the result.

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

const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

// Brand palette from public/locus-mark.svg and src/app/globals.css.
const THEMES = {
  dark: {
    background: "#0d1726",
    grid: "rgba(237, 241, 238, 0.045)",
    card: "#14233b",
    cardLine: "rgba(237, 241, 238, 0.10)",
    terminal: "#0a1220",
    text: "#edf1ee",
    muted: "#9fb2ad",
    faint: "#6f827e",
    cell: "#26374f",
    anchor: "#8ef0c0",
    closure: "#ffd45c",
    fix: "#ff896e",
    accent: "#3fbf9f",
    markTile: "#14233b",
    markLine: "rgba(237, 241, 238, 0.16)",
  },
  light: {
    background: "#edf1ee",
    grid: "rgba(20, 35, 59, 0.05)",
    card: "#f9fbf7",
    cardLine: "rgba(20, 35, 59, 0.12)",
    terminal: "#14233b",
    text: "#14233b",
    muted: "#4e605d",
    faint: "#6b7c78",
    cell: "#d3ddd7",
    anchor: "#0b8f6f",
    closure: "#d29a00",
    fix: "#d9492c",
    accent: "#087864",
    markTile: "#14233b",
    markLine: "transparent",
  },
};

// The terminal sits on a dark ground in both themes, so its text keeps the
// dark palette's colours.
const TERMINAL_TEXT = { text: "#edf1ee", muted: "#9fb2ad", anchor: "#8ef0c0", closure: "#ffd45c", fix: "#ff896e" };

const PERIOD = 12; // seconds per loop

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

function pct(seconds) {
  return Number(((seconds / PERIOD) * 100).toFixed(2));
}

function kiloTokens(value) {
  return `${(value / 1000).toFixed(1)}K`;
}

/**
 * Collects one keyframe rule per distinct timing, so the animation is driven by
 * keyframe percentages and never by animation-delay: a delay would leave the
 * element in its resting (final) style until it fired.
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

  /** Hidden until `at`, fades in, holds, fades out before the loop restarts. */
  reveal(at, fade = 0.35) {
    return this.#add(`0%,${pct(at)}%{opacity:0}${pct(at + fade)}%,${pct(PERIOD - 0.7)}%{opacity:1}${pct(PERIOD - 0.2)}%,100%{opacity:0}`);
  }

  /** Full opacity, dims to `to` at `at`, recovers for the next loop. */
  dim(at, to) {
    return this.#add(`0%,${pct(at)}%{opacity:1}${pct(at + 0.5)}%,${pct(PERIOD - 0.7)}%{opacity:${to}}${pct(PERIOD - 0.2)}%,100%{opacity:1}`);
  }

  /** Visible only between `start` and `end`; hidden at rest. */
  during(start, end) {
    return this.#add(`0%,${pct(start)}%{opacity:0}${pct(start) + 0.01}%,${pct(end)}%{opacity:1}${pct(end) + 0.01}%,100%{opacity:0}`);
  }

  /** Slides a cover right over `length` px in `steps`, which types the text beneath it. */
  type(start, end, length, steps) {
    return this.#add(
      `0%,${pct(start)}%{transform:translateX(0);animation-timing-function:steps(${steps},end)}` +
      `${pct(end)}%,${pct(PERIOD - 0.2)}%{transform:translateX(${length}px)}100%{transform:translateX(0)}`,
    );
  }

  css() {
    return [...this.rules].map(([body, name]) =>
      `@keyframes ${name}{${body}}.${name}{animation:${name} ${PERIOD}s linear infinite both}`,
    ).join("");
  }
}

function mark(x, y, size, theme) {
  const scale = size / 32;
  return `<g transform="translate(${x} ${y}) scale(${scale})">` +
    `<rect width="32" height="32" rx="7" fill="${theme.markTile}" stroke="${theme.markLine}"/>` +
    `<path d="M7 10.5h8.5a6 6 0 0 1 6 6v5" fill="none" stroke="#8ef0c0" stroke-width="2.5" stroke-linecap="round"/>` +
    `<path d="M7 21.5h8.5a6 6 0 0 0 6-6v-5" fill="none" stroke="#ffd45c" stroke-width="2.5" stroke-linecap="round"/>` +
    `<rect x="19" y="19" width="6" height="6" rx="2" fill="#ff896e"/></g>`;
}

function document({ width, height, title, desc, theme, body, css }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
<title id="title">${escapeXml(title)}</title>
<desc id="desc">${escapeXml(desc)}</desc>
<style>${css}@media (prefers-reduced-motion: reduce){*{animation:none!important}}</style>
<defs><pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="${theme.grid}"/></pattern></defs>
<rect width="${width}" height="${height}" rx="24" fill="${theme.background}"/>
<rect width="${width}" height="${height}" rx="24" fill="url(#grid)"/>
${body}
</svg>
`;
}

// ---------------------------------------------------------------------------
// Hero
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

/** The file grid: one cell per source file, anchors and closure lit in turn. */
function fileGrid(run, timeline, theme, { x, y, columns, cell, gap }) {
  const parts = [];
  const closureFiles = run.files.filter((file) => file.role === "closure");
  run.files.forEach((file, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const cx = x + column * (cell + gap);
    const cy = y + row * (cell + gap);
    const appear = timeline.reveal(0.15 + column * 0.04, 0.3);
    if (file.role === "excluded") {
      const dim = timeline.dim(5.6, 0.32);
      parts.push(`<g class="${appear}"><rect class="${dim}" x="${cx}" y="${cy}" width="${cell}" height="${cell}" rx="${cell * 0.22}" fill="${theme.cell}" opacity="0.32"/></g>`);
      return;
    }
    const lit = file.role === "anchor"
      ? timeline.reveal(4.0 + run.files.filter((other, otherIndex) => other.role === "anchor" && otherIndex < index).length * 0.08, 0.3)
      : timeline.reveal(4.6 + closureFiles.indexOf(file) * 0.06, 0.3);
    const fill = file.role === "anchor" ? theme.anchor : theme.closure;
    parts.push(
      `<rect class="${appear}" x="${cx}" y="${cy}" width="${cell}" height="${cell}" rx="${cell * 0.22}" fill="${theme.cell}"/>` +
      `<rect class="${lit}" x="${cx}" y="${cy}" width="${cell}" height="${cell}" rx="${cell * 0.22}" fill="${fill}"/>`,
    );
    if (file.fixed) {
      const ring = timeline.reveal(7.0, 0.3);
      const inset = Math.max(2.5, cell * 0.09);
      parts.push(
        `<rect class="${ring}" x="${cx - inset}" y="${cy - inset}" width="${cell + inset * 2}" height="${cell + inset * 2}" rx="${cell * 0.32}" fill="none" stroke="${theme.fix}" stroke-width="${Math.max(2, cell * 0.07)}"/>`,
      );
    }
  });
  return parts.join("\n");
}

/**
 * Legend spread across `width`: items keep their natural size and share the
 * remaining space, so the last label ends at the card's inner edge rather than
 * wherever an even split would push it.
 */
function legend(theme, x, y, width, size, fontSize) {
  const items = [
    ["Anchor", theme.anchor, false],
    ["Closure", theme.closure, false],
    ["Excluded", theme.cell, false],
    ["Fixed by maintainer", theme.fix, true],
  ];
  // System sans averages a little over half an em per character.
  const itemWidth = ([label]) => size + 8 + label.length * fontSize * 0.55;
  const spare = width - items.reduce((sum, item) => sum + itemWidth(item), 0);
  const gap = Math.max(12, spare / (items.length - 1));
  let cursor = x;
  return items.map((item) => {
    const [label, color, ring] = item;
    const swatch = ring
      ? `<rect x="${cursor + 1.5}" y="${y - size + 1.5}" width="${size - 3}" height="${size - 3}" rx="${size * 0.28}" fill="none" stroke="${color}" stroke-width="2.5"/>`
      : `<rect x="${cursor}" y="${y - size}" width="${size}" height="${size}" rx="${size * 0.25}" fill="${color}"/>`;
    const text = `<text x="${cursor + size + 8}" y="${y - 1}" font-size="${fontSize}" fill="${theme.muted}">${label}</text>`;
    cursor += itemWidth(item) + gap;
    return swatch + text;
  }).join("");
}

/** Typed command lines plus the output that appears after the Slice lights up. */
function terminal(run, timeline, { x, y, width, lineHeight, fontSize, charWidth, wrapAt, padding }) {
  const commandLines = wrap(`$ locus locate "${run.task}"`, wrapAt);
  const fixed = run.files.find((file) => file.fixed);
  const outputs = [
    [`Slice   ${run.sliceFiles} of ${run.repositoryFiles} files`, TERMINAL_TEXT.text],
    [`Tokens  ${kiloTokens(run.sliceTokens)} of ${kiloTokens(run.repositoryTokens)} (estimated)`, TERMINAL_TEXT.text],
    [`Saved   ${run.reductionPct}% of the repository's context`, TERMINAL_TEXT.anchor],
    [`Fixed   ${fixed.path}  in Slice ✓`, TERMINAL_TEXT.fix],
  ];
  const height = padding * 2 + 26 + (commandLines.length + 0.4 + outputs.length) * lineHeight;
  const parts = [`<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="16" fill="#0a1220" stroke="rgba(237,241,238,0.10)"/>`];
  ["#ff896e", "#ffd45c", "#8ef0c0"].forEach((color, index) => {
    parts.push(`<circle cx="${x + padding + index * 18}" cy="${y + padding + 2}" r="5" fill="${color}" opacity="0.85"/>`);
  });
  const textX = x + padding;
  let lineY = y + padding + 26 + lineHeight * 0.75;
  const typeStart = 0.8;
  const typeEnd = 3.6;
  const totalChars = commandLines.reduce((sum, line) => sum + line.length, 0);
  let elapsed = typeStart;
  commandLines.forEach((line) => {
    const length = line.length * charWidth;
    const duration = ((typeEnd - typeStart) * line.length) / totalChars;
    const slide = timeline.type(elapsed, elapsed + duration, length + charWidth, line.length + 1);
    parts.push(
      `<text x="${textX}" y="${lineY}" font-family="${MONO}" font-size="${fontSize}" fill="${TERMINAL_TEXT.text}" textLength="${length}" lengthAdjust="spacingAndGlyphs" xml:space="preserve">${escapeXml(line)}</text>`,
      // Resting position is fully slid, so a static render shows the whole line.
      `<g style="transform:translateX(${length + charWidth}px)" class="${slide}"><rect x="${textX - 2}" y="${lineY - fontSize}" width="${width - padding}" height="${lineHeight}" fill="#0a1220"/><rect class="${timeline.during(elapsed, elapsed + duration + 0.15)}" x="${textX - 2}" y="${lineY - fontSize + 2}" width="${charWidth}" height="${fontSize + 2}" fill="${TERMINAL_TEXT.anchor}" opacity="0"/></g>`,
    );
    elapsed += duration;
    lineY += lineHeight;
  });
  lineY += lineHeight * 0.4;
  outputs.forEach(([text, color], index) => {
    const reveal = timeline.reveal(index === 3 ? 7.0 : 6.0 + index * 0.3);
    parts.push(`<text class="${reveal}" x="${textX}" y="${lineY}" font-family="${MONO}" font-size="${fontSize}" fill="${color}" xml:space="preserve">${escapeXml(text)}</text>`);
    lineY += lineHeight;
  });
  // The typing covers slide past the right edge; clip them to the terminal.
  const clipId = `terminal-${x}-${y}`;
  const [frame, ...content] = parts;
  return {
    svg: `<clipPath id="${clipId}"><rect x="${x + 1}" y="${y + 1}" width="${width - 2}" height="${height - 2}" rx="15"/></clipPath>\n${frame}\n<g clip-path="url(#${clipId})">\n${content.join("\n")}\n</g>`,
    height,
  };
}

function heroText(run) {
  const fixed = run.files.find((file) => file.fixed);
  return {
    title: "Locus: show your coding agent only the code it needs",
    desc: `Animated replay of a real held-out benchmark run. Task: "${run.task}" on ${run.repo} at ${run.snapshot}. ` +
      `Each of the ${run.repositoryFiles} cells is a source file. Locus anchors ${run.files.filter((file) => file.role === "anchor").length} files, ` +
      `adds their dependency closure, and excludes the rest: ${run.sliceFiles} of ${run.repositoryFiles} files, ` +
      `${kiloTokens(run.sliceTokens)} of ${kiloTokens(run.repositoryTokens)} estimated tokens, ${run.reductionPct}% less context. ` +
      `The file the maintainer fixed, ${fixed.path}, is in the Slice.`,
  };
}

function heroDesktop(run, themeName) {
  const theme = THEMES[themeName];
  const timeline = new Timeline();
  const width = 1280;
  const height = 660;
  const columns = 13;
  const cell = 28;
  const gap = 8;
  const rows = Math.ceil(run.files.length / columns);
  const gridWidth = columns * cell + (columns - 1) * gap;
  const cardX = 716;
  const cardY = 56;
  const cardWidth = 500;
  const gridX = cardX + (cardWidth - gridWidth) / 2;
  const gridY = cardY + 92;
  const cardHeight = 92 + rows * (cell + gap) - gap + 72;

  const term = terminal(run, timeline, {
    x: 64, y: 330, width: 600, lineHeight: 26, fontSize: 15, charWidth: 9, wrapAt: 58, padding: 22,
  });
  const body = [
    mark(64, 56, 40, theme),
    `<text x="118" y="85" font-family="${SANS}" font-size="28" font-weight="650" fill="${theme.text}">Locus</text>`,
    `<text x="64" y="172" font-family="${SANS}" font-size="54" font-weight="650" letter-spacing="-2" fill="${theme.text}">Show your agent only</text>`,
    `<text x="64" y="234" font-family="${SANS}" font-size="54" font-weight="650" letter-spacing="-2" fill="${theme.text}">the code it needs.</text>`,
    `<text x="66" y="284" font-family="${SANS}" font-size="21" fill="${theme.muted}">Task-scoped context and review evidence for coding agents.</text>`,
    term.svg,
    `<rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="${cardHeight}" rx="18" fill="${theme.card}" stroke="${theme.cardLine}"/>`,
    `<text x="${cardX + 28}" y="${cardY + 40}" font-family="${SANS}" font-size="17" font-weight="600" fill="${theme.text}">${escapeXml(run.repo)}  ·  ${run.repositoryFiles} source files</text>`,
    `<text x="${cardX + 28}" y="${cardY + 64}" font-family="${SANS}" font-size="14" fill="${theme.muted}">Held-out benchmark run · snapshot ${run.snapshot} · one cell per file</text>`,
    fileGrid(run, timeline, theme, { x: gridX, y: gridY, columns, cell, gap }),
    `<g font-family="${SANS}">${legend(theme, cardX + 28, cardY + cardHeight - 30, cardWidth - 56, 13, 13)}</g>`,
    `<text x="64" y="${height - 36}" font-family="${SANS}" font-size="14" fill="${theme.faint}">Recorded from a real run. Token counts are Locus's chars/4 estimate.</text>`,
  ].join("\n");
  return document({ width, height, ...heroText(run), theme, body, css: timeline.css() });
}

function heroMobile(run, themeName) {
  const theme = THEMES[themeName];
  const timeline = new Timeline();
  const width = 720;
  const columns = 13;
  const cell = 35;
  const gap = 9;
  const rows = Math.ceil(run.files.length / columns);
  const gridWidth = columns * cell + (columns - 1) * gap;
  const cardX = 40;
  const cardY = 350;
  const cardWidth = width - 80;
  const cardHeight = 108 + rows * (cell + gap) - gap + 120;
  const gridX = cardX + (cardWidth - gridWidth) / 2;
  const gridY = cardY + 108;
  const termY = cardY + cardHeight + 32;
  const term = terminal(run, timeline, {
    x: 40, y: termY, width: cardWidth, lineHeight: 38, fontSize: 22, charWidth: 13.2, wrapAt: 44, padding: 30,
  });
  const height = termY + term.height + 92;
  const body = [
    mark(40, 48, 56, theme),
    `<text x="114" y="89" font-family="${SANS}" font-size="40" font-weight="650" fill="${theme.text}">Locus</text>`,
    `<text x="40" y="196" font-family="${SANS}" font-size="62" font-weight="650" letter-spacing="-2.5" fill="${theme.text}">Show your agent only</text>`,
    `<text x="40" y="266" font-family="${SANS}" font-size="62" font-weight="650" letter-spacing="-2.5" fill="${theme.text}">the code it needs.</text>`,
    `<text x="42" y="316" font-family="${SANS}" font-size="26" fill="${theme.muted}">Task-scoped context for coding agents.</text>`,
    `<rect x="${cardX}" y="${cardY}" width="${cardWidth}" height="${cardHeight}" rx="24" fill="${theme.card}" stroke="${theme.cardLine}"/>`,
    `<text x="${cardX + 34}" y="${cardY + 50}" font-family="${SANS}" font-size="26" font-weight="600" fill="${theme.text}">${escapeXml(run.repo)} · ${run.repositoryFiles} files</text>`,
    `<text x="${cardX + 34}" y="${cardY + 82}" font-family="${SANS}" font-size="20" fill="${theme.muted}">Held-out run · one cell per source file</text>`,
    fileGrid(run, timeline, theme, { x: gridX, y: gridY, columns, cell, gap }),
    `<g font-family="${SANS}">${legend(theme, cardX + 34, cardY + cardHeight - 66, cardWidth - 68, 19, 19)}</g>`,
    term.svg,
    `<text x="40" y="${height - 40}" font-family="${SANS}" font-size="20" fill="${theme.faint}">Recorded from a real run. Tokens are chars/4 estimates.</text>`,
  ].join("\n");
  return document({ width, height, ...heroText(run), theme, body, css: timeline.css() });
}

// ---------------------------------------------------------------------------
// Held-out chart
// ---------------------------------------------------------------------------

function heldoutChart(heldout, themeName) {
  const theme = THEMES[themeName];
  const { summary } = heldout;
  const width = 1280;
  const height = 430;
  const groups = [
    ["Task as written", summary.localized, summary.cases - summary.widenedCases],
    ["Scope word removed", summary.withoutScope.localized, summary.withoutScope.cases - summary.withoutScope.widenedCases],
  ];
  const barX = 380;
  const barWidth = 600;
  const parts = [
    `<text x="64" y="72" font-family="${SANS}" font-size="28" font-weight="650" fill="${theme.text}">Fix-file recall on ${summary.cases} held-out bug fixes</text>`,
    `<text x="64" y="104" font-family="${SANS}" font-size="17" fill="${theme.muted}">Localized cases from ${summary.repositories} third-party repositories Locus was never tuned on. Higher is better.</text>`,
  ];
  let y = 156;
  for (const [label, stats, count] of groups) {
    parts.push(`<text x="64" y="${y + 22}" font-family="${SANS}" font-size="19" font-weight="600" fill="${theme.text}">${label}</text>`);
    parts.push(`<text x="64" y="${y + 46}" font-family="${SANS}" font-size="15" fill="${theme.muted}">${count} localized cases</text>`);
    parts.push(`<text x="64" y="${y + 68}" font-family="${SANS}" font-size="15" fill="${theme.muted}">${stats.medianContextReductionPct}% median context saved</text>`);
    const bars = [
      ["Locus Slice", stats.fixFileRecall, theme.anchor],
      ["Random Slice, same size", stats.meanChanceRecall, theme.faint],
    ];
    bars.forEach(([name, value, color], index) => {
      const barY = y + index * 34;
      const length = Math.max(4, value * barWidth);
      parts.push(`<rect x="${barX}" y="${barY}" width="${barWidth}" height="24" rx="6" fill="${theme.cell}" opacity="0.5"/>`);
      parts.push(`<rect x="${barX}" y="${barY}" width="${length}" height="24" rx="6" fill="${color}"/>`);
      parts.push(`<text x="${barX + barWidth + 16}" y="${barY + 18}" font-family="${SANS}" font-size="17" font-weight="600" fill="${theme.text}">${(value * 100).toFixed(1)}%</text>`);
      parts.push(`<text x="${barX + barWidth + 98}" y="${barY + 18}" font-family="${SANS}" font-size="15" fill="${theme.muted}">${name}</text>`);
    });
    y += 108;
  }
  parts.push(`<text x="64" y="${height - 40}" font-family="${SANS}" font-size="14" fill="${theme.faint}">Source: benchmarks/heldout/results.json (${summary.protocolVersion}). Recall is whether the files the maintainer changed are in the Slice, not whether an agent fixed the bug.</text>`);
  const desc = `Bar chart. With the task as written, Locus's Slice contained ${(summary.localized.fixFileRecall * 100).toFixed(1)}% of fix files on localized cases, ` +
    `against ${(summary.localized.meanChanceRecall * 100).toFixed(1)}% for a random Slice of the same size. With the scope word removed, ` +
    `${(summary.withoutScope.localized.fixFileRecall * 100).toFixed(1)}% against ${(summary.withoutScope.localized.meanChanceRecall * 100).toFixed(1)}%.`;
  return document({ width, height, title: "Held-out fix-file recall", desc, theme, body: parts.join("\n"), css: "" });
}

// ---------------------------------------------------------------------------

function render() {
  const run = JSON.parse(fs.readFileSync(heroRunPath, "utf8"));
  const heldout = JSON.parse(fs.readFileSync(heldoutPath, "utf8"));
  const outputs = {};
  for (const themeName of Object.keys(THEMES)) {
    outputs[`hero-${themeName}.svg`] = heroDesktop(run, themeName);
    outputs[`hero-mobile-${themeName}.svg`] = heroMobile(run, themeName);
    outputs[`heldout-${themeName}.svg`] = heldoutChart(heldout, themeName);
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

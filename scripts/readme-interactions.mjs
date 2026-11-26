// Product interaction replays for the README. The map and handoff use the
// website's own bundled Repo, recorded orbit edges and deterministic localizer.
// The case explorer reads the same held-out results as CaseBoard. A cursor is
// presentation, never a provider call or an assertion that an agent succeeded.
import fs from "node:fs";
import path from "node:path";
import { buildGraph, locate } from "../bin/core.mjs";

export function createInteractionScenes({ projectRoot, document, themes, serif, mono, Timeline, escapeXml, n, wrap }) {
  const read = (file) => fs.readFileSync(path.join(projectRoot, file), "utf8");
  const repo = JSON.parse(read("public/repos/taxonomy.json"));
  const records = JSON.parse(read("src/lib/landing-orbits.json"));
  const files = Object.keys(repo.files).sort();
  const graph = buildGraph(repo);
  const runs = records.map((entry) => locate(entry.task, repo, graph));
  const run = runs[0]; // The separate context-handoff replay uses the editor task.
  records.forEach((entry, i) => {
    const result = runs[i];
    const expectedFiles = entry.widened ? files.length : entry.slice.length;
    if (result.widened !== entry.widened || result.slice.length !== expectedFiles || result.sliceTokens !== entry.sliceTokens || result.totalTokens !== entry.totalTokens) {
      throw new Error(`README interaction data disagrees with website task ${i + 1}.`);
    }
    if (!entry.widened) {
      const expected = entry.slice.map(([index]) => files[index]).sort();
      if (JSON.stringify(result.slice.map((file) => file.path).sort()) !== JSON.stringify(expected)) {
        throw new Error(`README orbit file identities disagree with website task ${i + 1}.`);
      }
    }
  });
  const sourceFiles = JSON.parse(read("src/lib/landing-slice.ts").match(/files:\s*(\[[\s\S]*?\n  \]),/)[1].replace(/,\s*]/g, "]"));
  if (JSON.stringify(sourceFiles) !== JSON.stringify(files)) throw new Error("Orbit file ordering changed; inspect the interaction replay.");
  const layoutSource = read("src/lib/locus-layout.ts");
  const rings = JSON.parse(layoutSource.match(/export const RINGS = (\[[^\]]+\])/)[1]);
  const rim = Number(layoutSource.match(/export const RIM = (\d+)/)[1]);
  const angleFor = (file) => n(-90 + file * 360 / files.length);
  const point = ({ angle, radius }) => ({ x: n(radius * Math.cos(angle * Math.PI / 180)), y: n(radius * Math.sin(angle * Math.PI / 180)) });
  // Same golden-angle disc and ring assignment as locus-layout.ts. Widen keeps
  // all 125 files; the recorded empty slice is not a zero-file result.
  const disc = files.map((_, i) => {
    const angle = i * Math.PI * (3 - Math.sqrt(5));
    const radius = 25.5 * Math.sqrt(i + .4);
    return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
  }).map(({ x, y }) => ({ angle: Math.atan2(y, x) * 180 / Math.PI, radius: Math.hypot(x, y) }))
    .map((p) => ({ ...p, angle: p.angle < -90 ? p.angle + 360 : p.angle }))
    .sort((a, b) => a.angle - b.angle)
    .map((p, i) => ({ angle: n(p.angle + 360 * Math.round((angleFor(i) - p.angle) / 360)), radius: n(p.radius), hop: 0 }));
  const layouts = records.map((entry) => {
    if (entry.widened) return disc;
    const places = files.map((_, i) => ({ angle: angleFor(i), radius: rim, hop: -1 }));
    for (const hop of [...new Set(entry.slice.map(([, hop]) => hop))]) {
      const group = entry.slice.filter(([, h]) => h === hop).map(([i]) => i).sort((a, b) => a - b);
      const step = 360 / group.length;
      const offset = group.reduce((sum, i, k) => sum + angleFor(i) - k * step, 0) / group.length;
      group.forEach((i, k) => { places[i] = { angle: n(offset + k * step), radius: hop === 0 && group.length === 1 ? 0 : rings[Math.min(hop, rings.length - 1)], hop }; });
    }
    return places;
  });
  const number = (value) => value.toLocaleString("en-US");
  const text = (x, y, value, theme, size = 18, options = {}) => `<text x="${n(x)}" y="${n(y)}" font-size="${size}" fill="${options.color ?? theme["ink-2"]}"${options.mono ? ` font-family="${mono}"` : ""}${options.anchor ? ` text-anchor="${options.anchor}"` : ""}>${escapeXml(value)}</text>`;
  const lines = (x, y, values, theme, size = 18, options = {}) => values.map((value, i) => text(x, y + i * (options.leading ?? size * 1.5), value, theme, size, options)).join("");
  const title = (x, y, value, theme, size) => `<text x="${x}" y="${y}" font-family="${serif}" font-size="${size}" letter-spacing="-1.1" fill="${theme.ink}">${escapeXml(value)}</text>`;
  const rect = (x, y, w, h, theme, fill = theme.surface, rx = 5) => `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="${rx}" fill="${fill}" stroke="${theme["line-2"]}"/>`;
  const cursor = (clock, positions, theme, from = .5, to = 8.5) => {
    const rule = clock.keyframes(positions.map(([at, x, y]) => `${at}%{transform:translate(${n(x)}px,${n(y)}px)}`).join(""));
    const [, x, y] = positions.at(-1);
    return `<g opacity="0" class="${clock.during(from, to)}"><g transform="translate(${x} ${y})" class="${rule}"><path d="M0 0v26l7-7 7 15 6-3-7-14 13-1Z" fill="${theme.ink}" stroke="${theme.canvas}" stroke-width="2" stroke-linejoin="round"/></g></g>`;
  };
  const header = (theme, mobile, eyebrow, heading, subtitle) => {
    const pad = mobile ? 40 : 48;
    return text(pad, 48, eyebrow, theme, mobile ? 18 : 13, { mono: true, color: theme["included-ink"] }) +
      title(pad - 2, mobile ? 119 : 116, heading, theme, mobile ? 56 : 57) +
      lines(pad, mobile ? 166 : 157, wrap(subtitle, mobile ? 47 : 120), theme, mobile ? 23 : 19, { color: theme.muted, leading: 32 });
  };
  const finish = (theme, mobile, clock, body, heading, desc, height, extraCss = "") => document({ width: mobile ? 720 : 1280, height, title: heading, desc, theme, body, css: clock.css() + extraCss });

  function inspect(themeName, mobile) {
    const theme = themes[themeName]; const clock = new Timeline(24);
    const height = mobile ? 1320 : 760;
    const pad = mobile ? 40 : 48;
    const map = mobile ? { x: 360, y: 982, scale: .77 } : { x: 935, y: 417, scale: .72 };
    const taskY = mobile ? 260 : 227; const taskWidth = mobile ? 640 : 493; const row = mobile ? 60 : 58;
    const pct = (seconds) => n(seconds / 24 * 100);
    // Each task has a six-second chapter. Text changes during the map morph;
    // edges and hover appear only after the new positions have settled.
    const window = (index, start = .4, end = 5.3) => {
      const a = index * 6 + start; const b = index * 6 + end;
      return clock.keyframes(`0%{opacity:0}${pct(a)}%{opacity:0}${pct(a + .25)}%,${pct(b)}%{opacity:1}${pct(b + .25)}%,100%{opacity:0}`);
    };
    const state = (index) => index === 0
      ? clock.keyframes("0%,22.08%{opacity:1}23.12%,98.33%{opacity:0}99.37%,100%{opacity:1}")
      : window(index, -.4, 5.3);
    const sample = (values) => {
      let keyframes = `0%{${values[0]}}`;
      for (let i = 0; i < 4; i++) {
        keyframes += `${pct(i * 6 + 5.3)}%{${values[i]};animation-timing-function:cubic-bezier(.22,1,.36,1)}`;
        keyframes += `${pct(i === 3 ? 24 : (i + 1) * 6 + .4)}%{${values[(i + 1) % 4]}}`;
      }
      return clock.keyframes(keyframes);
    };
    const p = (place) => { const xy = point(place); return { x: n(map.x + xy.x * map.scale), y: n(map.y + xy.y * map.scale) }; };
    const targets = [files.indexOf("components/editor.tsx"), records[1].anchors[0], files.indexOf("app/(dashboard)/dashboard/billing/page.tsx"), -1];
    const neighbors = targets.map((target, i) => new Set(records[i].edges.filter(([a, b]) => a === target || b === target).flatMap(([a, b]) => [a, b])));
    const shortPath = (file) => file.length <= 26 ? file : "…/" + file.split("/").slice(-2).join("/");
    let body = header(theme, mobile, "INSPECT THE SLICE / FOUR RECORDED TASKS", "One repo. Four tasks.", "Watch the same files move. Each task changes what belongs in the Slice.");
    records.forEach((entry, i) => {
      const y = taskY + i * row;
      body += `<path d="M${pad} ${y - 25}h${taskWidth}" stroke="${theme.line}"/>`;
      body += `<g opacity="${i === 0 ? 1 : 0}" class="${state(i)}"><path d="M${pad} ${y - 25}h${taskWidth}" stroke="${theme.included}" stroke-width="2"/><rect x="${pad - 12}" y="${y - 12}" width="3" height="15" rx="1" fill="${theme.included}"/></g>`;
      body += text(pad, y, `0${i + 1}`, theme, mobile ? 19 : 14, { mono: true, color: theme.muted });
      body += text(pad + 36, y, entry.task, theme, mobile ? 24 : 19);
      body += text(pad + taskWidth, y + 25, entry.widened ? "125 / 125 · Widened" : `${entry.slice.length} / ${files.length}`, theme, mobile ? 19 : 15, { mono: true, anchor: "end", color: theme.muted });
    });
    const metricY = taskY + records.length * row + 42;
    records.forEach((entry, i) => {
      const widened = entry.widened; const target = targets[i];
      body += `<g data-orbit-case="${i + 1}" data-orbit-count="${runs[i].slice.length}" opacity="${i === 0 ? 1 : 0}" class="${state(i)}">`;
      body += title(pad, metricY, String(runs[i].slice.length), theme, 64) + title(pad + 230, metricY, number(entry.sliceTokens), theme, 64);
      body += text(pad, metricY + 30, widened ? "WHOLE REPO KEPT" : "IN THE SLICE", theme, mobile ? 18 : 14, { mono: true, color: theme.muted }) + text(pad + 230, metricY + 30, `TOKENS OF ${number(entry.totalTokens)}`, theme, mobile ? 18 : 14, { mono: true, color: theme.muted });
      body += text(pad, metricY + 83, widened ? "No confident task match." : shortPath(files[target]), theme, mobile ? 25 : 22, { mono: !widened, color: theme.ink });
      body += lines(pad, metricY + 116, widened ? ["Widened · nothing silently left out.", "Refine the task to get a focused Slice."] : ["Anchor · matches this task.", "Hover keeps its connected imports bright."], theme, mobile ? 23 : 19, { color: theme["included-ink"], leading: 31 });
      body += "</g>";
    });
    const ringOpacity = sample(["opacity:1", "opacity:1", "opacity:1", "opacity:.24"]);
    body += `<g class="${ringOpacity}">`;
    for (const radius of [...rings, rim]) body += `<circle cx="${map.x}" cy="${map.y}" r="${n(radius * map.scale)}" fill="none" stroke="${theme["line-2"]}" stroke-dasharray="2 5"/>`;
    body += `</g><circle cx="${map.x}" cy="${map.y}" r="${n(365 * map.scale)}" fill="none" stroke="${theme["line-2"]}" stroke-dasharray="1 7"/>`;
    records.forEach((entry, i) => {
      body += `<g opacity="${i === 0 ? 1 : 0}" class="${window(i, 1.6, 5.1)}">`;
      for (const [from, to] of entry.edges) {
        const a = p(layouts[i][from]); const b = p(layouts[i][to]); const touched = from === targets[i] || to === targets[i];
        body += `<path d="M${a.x} ${a.y}L${b.x} ${b.y}" stroke="${touched ? theme.included : theme.line}" stroke-width="${touched ? 1.5 : .7}" fill="none"/>`;
      }
      body += "</g>";
    });
    files.forEach((file, fileIndex) => {
      const transforms = layouts.map((places, i) => {
        const at = p(places[fileIndex]);
        const turn = records[i].widened ? 0 : n(places[fileIndex].angle - 90 * Math.round(places[fileIndex].angle / 90));
        return `transform:translate(${at.x}px,${at.y}px) rotate(${turn}deg)`;
      });
      const colors = layouts.map((places) => `fill:${places[fileIndex].hop < 0 ? theme.excluded : theme.included}`);
      const holes = layouts.map((places, i) => `opacity:${places[fileIndex].hop === 0 && !records[i].widened ? 1 : 0}`);
      // Dimming happens only during the hover hold, then clears before a morph.
      const dimming = records.map((entry, i) => {
        const dim = !entry.widened && layouts[i][fileIndex].hop >= 0 && fileIndex !== targets[i] && !neighbors[i].has(fileIndex);
        return `${pct(i * 6)}%,${pct(i * 6 + 1.6)}%{opacity:1}${pct(i * 6 + 2)}%,${pct(i * 6 + 4.8)}%{opacity:${dim ? .28 : 1}}${pct(i * 6 + 5.2)}%,${pct(i * 6 + 6)}%{opacity:1}`;
      }).join("");
      const at = p(layouts[0][fileIndex]);
      const turn = n(layouts[0][fileIndex].angle - 90 * Math.round(layouts[0][fileIndex].angle / 90));
      body += `<g data-orbit-file="${fileIndex}" transform="translate(${at.x} ${at.y}) rotate(${turn})" class="${sample(transforms)}"><g class="${clock.keyframes(dimming)}"><rect x="-4.5" y="-4.5" width="9" height="9" rx="1" fill="${layouts[0][fileIndex].hop < 0 ? theme.excluded : theme.included}" class="${sample(colors)}"/><rect x="-1.7" y="-1.7" width="3.4" height="3.4" fill="${theme.canvas}" opacity="${layouts[0][fileIndex].hop === 0 ? 1 : 0}" class="${sample(holes)}"/></g></g>`;
    });
    records.forEach((entry, i) => {
      if (entry.widened) return;
      const at = p(layouts[i][targets[i]]);
      const tooltip = { x: mobile ? 280 : 805, y: mobile ? 1132 : 620, width: mobile ? 390 : 413 };
      body += `<g opacity="${i === 0 ? 1 : 0}" class="${window(i, 2, 5)}"><circle cx="${at.x}" cy="${at.y}" r="14" fill="none" stroke="${theme["included-ink"]}" stroke-width="1.5"/>${rect(tooltip.x, tooltip.y, tooltip.width, 65, theme)}` + text(tooltip.x + 15, tooltip.y + 27, shortPath(files[targets[i]]), theme, mobile ? 23 : 20, { mono: true, color: theme.ink }) + text(tooltip.x + 15, tooltip.y + 51, "Anchor · connected imports", theme, mobile ? 20 : 17, { color: theme["included-ink"] }) + "</g>";
      body += cursor(clock, [[0, pad + 160, taskY + i * row], [pct(i * 6 + .4), pad + 190, taskY + i * row], [pct(i * 6 + 1.8), at.x + 5, at.y + 6], [pct(i * 6 + 5), at.x + 5, at.y + 6], [100, at.x + 5, at.y + 6]], theme, i * 6 + .35, i * 6 + 5.1);
    });
    body += text(pad, height - 34, "Recorded taxonomy tasks · 6 seconds each · estimated tokens", theme, mobile ? 20 : 15, { color: theme.muted });
    return finish(theme, mobile, clock, body, "One repo. Four tasks.", "A 24-second replay cycles through all four website tasks using the same 125 taxonomy files: editor 14, webhook 3, billing 23, and Widen 125. Marks morph into each recorded import-distance layout. The vague task keeps every file in a filled disc. Hover highlights actual Anchor connections. Reduced motion shows the finished editor result.", height);
  }

  function evidence(heldout, themeName, mobile) {
    const theme = themes[themeName]; const clock = new Timeline(); const pad = mobile ? 40 : 48;
    const height = mobile ? 1280 : 730;
    const featured = heldout.results.find((r) => r.commit === "bc273fd");
    const rows = heldout.results.map((r, index) => ({ ...r, caseNumber: index + 1 })).filter((r) => r.repo === featured.repo).slice(4, 9);
    const list = mobile ? { x: pad, y: 273, width: 640, height: 338 } : { x: pad, y: 257, width: 547, height: 337 };
    const detail = mobile ? { x: pad, y: 646, width: 640, height: 452 } : { x: 623, y: 257, width: 609, height: 337 };
    let body = header(theme, mobile, "EVIDENCE / INSPECT A REAL HELD-OUT FIX", "Inspect a real fix.", "A repository tab, a case row, and the exact file the maintainer changed.");
    const repos = [...new Set(heldout.results.map((r) => r.repo))];
    const tabsY = mobile ? 226 : 211;
    repos.forEach((name, i) => {
      const x = pad + i * (mobile ? 104 : 142); const selected = name === featured.repo;
      body += text(x + 37, tabsY, name.split("/").pop(), theme, mobile ? 20 : 19, { anchor: "middle", color: selected ? theme.ink : theme.muted });
      if (selected) body += `<path class="${clock.reveal(1.7)}" d="M${x} ${tabsY + 15}h78" stroke="${theme.included}" stroke-width="3"/>`;
    });
    body += rect(list.x, list.y, list.width, list.height, theme);
    rows.forEach((item, i) => {
      const y = list.y + 30 + i * 61; const selected = item.commit === featured.commit;
      if (i === 0) body += `<g opacity="0" class="${clock.lift(3.8, .12)}"><rect x="${list.x + 1}" y="${y - 24}" width="${list.width - 2}" height="60" fill="${theme["surface-2"]}"/></g>`;
      if (selected) body += `<g class="${clock.reveal(3.8)}"><rect x="${list.x + 1}" y="${y - 24}" width="${list.width - 2}" height="60" fill="${theme["surface-2"]}"/><path d="M${list.x + 1} ${y - 24}v60" stroke="${theme.included}" stroke-width="3"/></g>`;
      body += text(list.x + 15, y, String(item.caseNumber).padStart(2, "0"), theme, mobile ? 20 : 16, { mono: true, color: theme.muted });
      const task = item.task.length > (mobile ? 37 : 40) ? item.task.slice(0, mobile ? 35 : 38) + "…" : item.task;
      body += text(list.x + 53, y, task, theme, mobile ? 20 : 17, { color: selected ? theme.ink : theme["ink-2"] });
      body += text(list.x + list.width - 17, y, item.widened ? "Widened" : `${item.contextReductionPct}%`, theme, mobile ? 18 : 14, { anchor: "end", color: item.widened ? theme.widened : theme.muted });
      const available = list.width - 80; const marks = Math.round(item.sliceFiles / item.repositoryFiles * 100);
      for (let m = 0; m < 100; m++) body += `<rect x="${n(list.x + 54 + m * (available / 100))}" y="${y + 15}" width="${n(available / 100 - 1)}" height="6" fill="${m < marks ? theme.included : theme.excluded}"${m < item.found.length ? ` stroke="${theme.ink}" stroke-width=".7"` : ""}/>`;
    });
    const detailFor = (item) => {
      const caseNumber = item.caseNumber ?? heldout.results.findIndex((candidate) => candidate.repo === item.repo && candidate.commit === item.commit) + 1;
      let content = rect(detail.x, detail.y, detail.width, detail.height, theme);
      content += text(detail.x + 25, detail.y + 33, `CASE ${caseNumber} · ${item.repo} · ${item.commit}`, theme, mobile ? 19 : 15, { mono: true, color: theme["included-ink"] });
      const taskLines = wrap(item.task, mobile ? 45 : 50);
      content += lines(detail.x + 25, detail.y + 77, taskLines, theme, mobile ? 25 : 23, { color: theme.ink, leading: 32 });
      const statsY = detail.y + Math.max(190, 77 + (taskLines.length - 1) * 32 + 77);
      [[`${item.sliceFiles}/${item.repositoryFiles}`, "ADMITTED"], [`${item.contextReductionPct}%`, "LESS CONTEXT"], [`${item.found.length}/${item.expected.length}`, "FIX FILES FOUND"]].forEach(([value, label], i) => {
        const x = detail.x + 25 + i * (detail.width - 50) / 3;
        content += title(x, statsY, value, theme, mobile ? 42 : 40) + text(x, statsY + 28, label, theme, mobile ? 15 : 12, { mono: true, color: theme.muted });
      });
      content += text(detail.x + 25, statsY + 81, "Changed by the maintainer, inside the Slice", theme, mobile ? 20 : 17, { color: theme.muted });
      content += text(detail.x + 25, statsY + 118, item.expected[0], theme, mobile ? 24 : 23, { mono: true, color: theme["included-ink"] });
      if (mobile) content += lines(detail.x + 25, statsY + 178, ["Frozen parent snapshot: " + item.snapshot, `Scope removed: ${item.withoutScope.found.length}/${item.expected.length} fix files found`], theme, 20, { color: theme.muted, leading: 32 });
      return content;
    };
    body += `<g opacity="0" class="${clock.lift(3.8, .12)}">${detailFor(rows[0])}</g>`;
    body += `<g class="${clock.reveal(3.9)}">${detailFor(featured)}</g>`;
    const selectedY = list.y + 30 + rows.findIndex((item) => item.commit === featured.commit) * 61;
    body += cursor(clock, [[0, pad + 40, tabsY + 40], [14, pad + 2 * (mobile ? 104 : 142) + 38, tabsY - 8], [24, pad + 2 * (mobile ? 104 : 142) + 38, tabsY - 8], [31, list.x + list.width - 90, selectedY], [70, list.x + list.width - 90, selectedY], [100, list.x + list.width - 90, selectedY]], theme, .3, 8.5);
    body += text(pad, height - (mobile ? 118 : 81), `${heldout.summary.cases} fixes · ${heldout.summary.repositories} third-party Repos · every selected case reported`, theme, mobile ? 22 : 20, { color: theme.ink });
    body += lines(pad, height - (mobile ? 64 : 34), wrap("Recorded localization evidence · token estimates · agent outcomes measured separately", mobile ? 64 : 150), theme, mobile ? 16 : 15, { color: theme.muted, leading: 24 });
    return finish(theme, mobile, clock, body, "Pick a fix. Open the evidence.", "Replays CaseBoard repository selection and row inspection from the committed held-out results. Case 27 on jotai admits 17 of 130 files and includes the maintainer's changed file. It demonstrates localization recall, not autonomous task completion.", height);
  }

  function handoff(themeName, mobile) {
    const theme = themes[themeName]; const clock = new Timeline(); const pad = mobile ? 40 : 48;
    const height = mobile ? 1180 : 690;
    const left = mobile ? { x: pad, y: 237, width: 640, height: 332 } : { x: pad, y: 227, width: 536, height: 319 };
    const right = mobile ? { x: pad, y: 624, width: 640, height: 363 } : { x: 616, y: 227, width: 616, height: 319 };
    let body = header(theme, mobile, "HAND OFF / THE WEBSITE'S RECORDED WORKFLOW", "Take the context with you.", "Choose a format, copy the Slice, and paste it into your coding agent.");
    body += rect(left.x, left.y, left.width, left.height, theme);
    body += text(left.x + 24, left.y + 33, "CONTEXT FOR THE AGENT", theme, mobile ? 18 : 13, { mono: true, color: theme.muted });
    body += title(left.x + 24, left.y + 108, number(run.sliceTokens), theme, mobile ? 58 : 63);
    body += text(left.x + 220, left.y + 103, `/ ${number(run.totalTokens)} tokens`, theme, mobile ? 23 : 20, { color: theme.muted });
    body += `<rect x="${left.x + 24}" y="${left.y + 137}" width="${left.width - 48}" height="7" rx="3" fill="${theme["surface-2"]}"/><rect x="${left.x + 24}" y="${left.y + 137}" width="${n((left.width - 48) * run.sliceTokens / run.totalTokens)}" height="7" rx="3" fill="${theme.included}"/>`;
    body += text(left.x + 24, left.y + 181, `${run.slice.length} files in the Slice · ${files.length - run.slice.length} left out`, theme, mobile ? 23 : 21);
    const tabY = left.y + 211; const tabWidth = mobile ? 99 : 82;
    body += rect(left.x + 24, tabY, tabWidth * 3, 42, theme, theme.canvas, 4);
    body += `<g opacity="0" class="${clock.lift(2.4, .12)}"><rect x="${left.x + 26}" y="${tabY + 2}" width="${tabWidth - 2}" height="38" rx="3" fill="${theme["surface-2"]}" stroke="${theme["line-2"]}"/></g>`;
    body += `<g class="${clock.reveal(2.4)}"><rect x="${left.x + 24 + tabWidth}" y="${tabY + 2}" width="${tabWidth}" height="38" rx="3" fill="${theme["surface-2"]}" stroke="${theme["line-2"]}"/></g>`;
    ["Generic", "Claude", "Cursor"].forEach((label, i) => { body += text(left.x + 24 + tabWidth * (i + .5), tabY + 27, label, theme, mobile ? 20 : 17, { anchor: "middle", color: i === 1 ? theme.ink : theme.muted }); });
    const copy = { x: left.x + left.width - 181, y: tabY, width: 157 };
    const press = clock.keyframes("0%,30%{transform:scale(1)}32%,34%{transform:scale(.96)}35%,100%{transform:scale(1)}");
    body += `<g class="s ${press}">` + rect(copy.x, copy.y, copy.width, 42, theme, theme.ink, 4) + text(copy.x + copy.width / 2, copy.y + 27, "Copy context", theme, mobile ? 20 : 17, { anchor: "middle", color: theme.canvas }) + "</g>";
    body += `<g class="${clock.reveal(4.1)}">` + text(left.x + 24, left.y + 294, `✓ Copied ${run.slice.length} files · ~${number(run.sliceTokens)} tokens`, theme, mobile ? 21 : 18, { color: theme["included-ink"] }) + "</g>";
    body += rect(right.x, right.y, right.width, right.height, theme);
    body += text(right.x + 24, right.y + 33, "YOUR CODING AGENT · ~/taxonomy", theme, mobile ? 18 : 13, { mono: true, color: theme.muted });
    body += `<path d="M${right.x} ${right.y + 51}h${right.width}" stroke="${theme.line}"/>`;
    body += `<g opacity="0" class="${clock.lift(5.9, .15)}">` + text(right.x + 24, right.y + 101, "Ask your agent…", theme, mobile ? 24 : 22, { color: theme.muted }) + text(right.x + 24, right.y + 148, "Paste the context to begin.", theme, mobile ? 22 : 19, { color: theme.muted }) + "</g>";
    body += `<g class="${clock.reveal(5.9)}">`;
    body += lines(right.x + 24, right.y + 91, ["<context>", ...run.slice.slice(0, 3).map((file) => "  " + file.path.replace("app/(editor)/editor/", "…/editor/")), `  … ${run.slice.length - 3} more included files`, "</context>"], theme, mobile ? 20 : 17, { mono: true, color: theme["included-ink"], leading: mobile ? 31 : 30 });
    body += text(right.x + 24, right.y + (mobile ? 312 : 287), "Context attached. Ready for your instruction.", theme, mobile ? 21 : 18, { color: theme.ink }) + "</g>";
    body += cursor(clock, [[0, left.x + 50, left.y + 90], [17, left.x + 24 + tabWidth * 1.5, tabY + 19], [24, left.x + 24 + tabWidth * 1.5, tabY + 19], [32, copy.x + 76, copy.y + 22], [39, copy.x + 76, copy.y + 22], [48, right.x + right.width - 90, right.y + 159], [70, right.x + right.width - 90, right.y + 159], [100, right.x + right.width - 90, right.y + 159]], theme, .2, 8.4);
    body += lines(pad, height - (mobile ? 144 : 74), wrap("Your agent gets a focused brief. Your repository stays yours.", mobile ? 55 : 150), theme, mobile ? 22 : 21, { color: theme.ink, leading: 31 });
    body += lines(pad, height - (mobile ? 62 : 34), wrap("Recorded taxonomy localization · estimated tokens · no agent request is sent", mobile ? 72 : 150), theme, mobile ? 17 : 15, { color: theme.muted, leading: 23 });
    return finish(theme, mobile, clock, body, "Take the context with you", "Replays the actual website's format selection, copy-context confirmation, and paste into an agent view. The same bundled taxonomy Repo localizes to 14 files and 6,448 estimated tokens. The context excerpt is shortened; no agent request is sent.", height);
  }
  return { inspect, evidence, handoff };
}

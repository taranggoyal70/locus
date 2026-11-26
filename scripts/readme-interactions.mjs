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
  const run = locate(records[0].task, repo, buildGraph(repo));
  const recorded = records[0];
  if (run.slice.length !== recorded.slice.length || run.sliceTokens !== recorded.sliceTokens || run.totalTokens !== recorded.totalTokens) {
    throw new Error("README interaction data disagrees with the website's recorded localization.");
  }
  const sourceFiles = JSON.parse(read("src/lib/landing-slice.ts").match(/files:\s*(\[[\s\S]*?\n  \]),/)[1].replace(/,\s*]/g, "]"));
  if (JSON.stringify(sourceFiles) !== JSON.stringify(files)) throw new Error("Orbit file ordering changed; inspect the interaction replay.");
  const layoutSource = read("src/lib/locus-layout.ts");
  const rings = JSON.parse(layoutSource.match(/export const RINGS = (\[[^\]]+\])/)[1]);
  const rim = Number(layoutSource.match(/export const RIM = (\d+)/)[1]);
  const angleFor = (file) => -90 + file * 360 / files.length;
  const places = files.map((_, i) => ({ angle: angleFor(i), radius: rim, hop: -1 }));
  for (const hop of [...new Set(recorded.slice.map(([, hop]) => hop))]) {
    const group = recorded.slice.filter(([, h]) => h === hop).map(([i]) => i).sort((a, b) => a - b);
    const step = 360 / group.length;
    const offset = group.reduce((sum, i, k) => sum + angleFor(i) - k * step, 0) / group.length;
    group.forEach((i, k) => { places[i] = { angle: offset + k * step, radius: hop === 0 && group.length === 1 ? 0 : rings[Math.min(hop, rings.length - 1)], hop }; });
  }
  const point = ({ angle, radius }) => ({ x: radius * Math.cos(angle * Math.PI / 180), y: radius * Math.sin(angle * Math.PI / 180) });
  const grid = files.map((_, i) => ({ x: ((i % 13) - 6) * 40, y: (Math.floor(i / 13) - (Math.ceil(files.length / 13) - 1) / 2) * 40 }))
    .map((p) => ({ ...p, angle: Math.atan2(p.y, p.x) * 180 / Math.PI }))
    .map((p) => ({ ...p, angle: p.angle < -90 ? p.angle + 360 : p.angle })).sort((a, b) => a.angle - b.angle);
  const hover = files.indexOf("components/editor.tsx");
  const connected = new Set(recorded.edges.filter(([a, b]) => a === hover || b === hover).flatMap(([a, b]) => [a, b]));
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
    const theme = themes[themeName]; const clock = new Timeline();
    const height = mobile ? 1260 : 710;
    const pad = mobile ? 40 : 48; const map = mobile ? { x: 360, y: 898, scale: .67 } : { x: 929, y: 411, scale: .66 };
    const taskY = mobile ? 260 : 215; const taskWidth = mobile ? 640 : 493; const row = mobile ? 56 : 54;
    let body = header(theme, mobile, "INSPECT THE SLICE / WEBSITE INTERACTION REPLAY", "See why a file belongs.", "Hover a file. Its role and connected imports come into focus.");
    records.forEach((entry, i) => {
      const y = taskY + i * row;
      body += `<path d="M${pad} ${y - 24}h${taskWidth}" stroke="${i === 0 ? theme.ink : theme.line}"/>`;
      body += text(pad, y, `0${i + 1}`, theme, mobile ? 17 : 13, { mono: true, color: theme.muted });
      body += text(pad + 33, y, entry.task, theme, mobile ? 22 : 18, { color: i === 0 ? theme.ink : theme.muted });
      body += text(pad + taskWidth, y + (mobile ? 24 : 23), entry.widened ? "Widened" : `${entry.slice.length} / ${files.length}`, theme, mobile ? 18 : 14, { mono: true, anchor: "end", color: i === 0 ? theme["included-ink"] : theme.muted });
    });
    const metricY = taskY + records.length * row + 44;
    body += title(pad, metricY, String(run.slice.length), theme, mobile ? 56 : 62) + title(pad + 223, metricY, number(run.sliceTokens), theme, mobile ? 56 : 62);
    body += text(pad, metricY + 29, "IN THE SLICE", theme, mobile ? 16 : 13, { mono: true, color: theme.muted }) + text(pad + 223, metricY + 29, `TOKENS OF ${number(run.totalTokens)}`, theme, mobile ? 16 : 13, { mono: true, color: theme.muted });
    body += `<g class="${clock.reveal(4.2)}">` + text(pad, metricY + 79, files[hover], theme, mobile ? 23 : 21, { mono: true, color: theme.ink }) + text(pad, metricY + 109, "Anchor · connected imports highlighted", theme, mobile ? 20 : 17, { color: theme["included-ink"] }) + "</g>";
    const p = (place) => { const xy = point(place); return { x: n(map.x + xy.x * map.scale), y: n(map.y + xy.y * map.scale) }; };
    for (const radius of [...rings, rim, 365]) body += `<circle cx="${map.x}" cy="${map.y}" r="${n(radius * map.scale)}" fill="none" stroke="${theme["line-2"]}"${radius === 365 ? ' stroke-dasharray="1 7"' : radius === rim ? "" : ' stroke-dasharray="2 5"'}/>`;
    body += `<path d="M${map.x - 7} ${map.y}h14m-7-7v14" stroke="${theme.muted}"/>`;
    for (const [from, to] of recorded.edges) {
      const a = p(places[from]); const b = p(places[to]); const touched = from === hover || to === hover;
      body += `<path class="${clock.reveal(touched ? 4 : 2.5)}" d="M${a.x} ${a.y}L${b.x} ${b.y}" stroke="${touched ? theme.included : theme.line}" stroke-width="${touched ? 1.4 : .7}" fill="none"/>`;
    }
    files.forEach((file, i) => {
      const at = p(places[i]); const origin = { x: n(map.x + grid[i].x * map.scale), y: n(map.y + grid[i].y * map.scale) };
      const turn = n(places[i].angle - 90 * Math.round(places[i].angle / 90));
      const movement = clock.keyframes(`0%,7%{transform:translate(${origin.x}px,${origin.y}px) rotate(0deg);animation-timing-function:cubic-bezier(.22,1,.36,1)}25%,100%{transform:translate(${at.x}px,${at.y}px) rotate(${turn}deg)}`);
      const color = places[i].hop < 0 ? theme.excluded : theme.included;
      const dim = i === hover || connected.has(i) || places[i].hop < 0 ? "" : clock.keyframes("0%,31%{opacity:1}39%,100%{opacity:.22}");
      body += `<g transform="translate(${at.x} ${at.y}) rotate(${turn})" class="${movement}"><g class="${dim}"${dim ? ' opacity=".22"' : ""}><rect x="-4" y="-4" width="8" height="8" rx="1" fill="${color}"/>${places[i].hop === 0 ? `<rect x="-1.5" y="-1.5" width="3" height="3" fill="${theme.canvas}"/>` : ""}</g></g>`;
    });
    const hoverPoint = p(places[hover]);
    body += `<circle class="${clock.reveal(4)}" cx="${hoverPoint.x}" cy="${hoverPoint.y}" r="14" fill="none" stroke="${theme["included-ink"]}" stroke-width="1.5"/>`;
    const tooltip = { x: mobile ? 295 : 830, y: mobile ? 989 : 565 };
    body += `<g class="${clock.reveal(4.2)}">${rect(tooltip.x, tooltip.y, mobile ? 330 : 355, 59, theme)}` + text(tooltip.x + 14, tooltip.y + 25, "components/editor.tsx", theme, mobile ? 21 : 19, { mono: true, color: theme.ink }) + text(tooltip.x + 14, tooltip.y + 46, "Anchor · matches this task", theme, mobile ? 17 : 15, { color: theme["included-ink"] }) + "</g>";
    body += cursor(clock, [[0, pad + 180, taskY + 110], [12, pad + 190, taskY], [24, pad + 190, taskY], [35, hoverPoint.x + 5, hoverPoint.y + 6], [70, hoverPoint.x + 5, hoverPoint.y + 6], [100, hoverPoint.x + 5, hoverPoint.y + 6]], theme, .4, 8.4);
    body += text(pad, height - 34, "Recorded shadcn-ui/taxonomy example · hover replay", theme, mobile ? 20 : 15, { color: theme.muted });
    return finish(theme, mobile, clock, body, "See why a file belongs", "Replays the website's orbital file map and hover. Same bundled taxonomy Repo, recorded hop placement and import edges. The highlighted editor file is a task Anchor; connected imports remain bright while other included files dim.", height);
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

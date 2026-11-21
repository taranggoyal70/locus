// Records the Slices Fig. 1 on the landing page replays.
//
// The landing page does not ship the localizer to signed-out visitors
// (docs/security/ip-protection.md). Fig. 1 replays these records instead: every
// task in src/lib/landing-tasks.ts, and each refinement a Widened one offers,
// localized on the bundled copy of shadcn-ui/taxonomy. landing-runs.test.ts
// re-runs the localizer and fails when this record drifts from it, so rerun
// this after changing the localizer or the task list.
//
//   pnpm landing:record
//
// Loads the TypeScript sources directly, which needs Node 22.18 or later.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { LANDING_REPO, landingRuns } from "../src/lib/landing-tasks.ts";
import { buildGraph, locate } from "../src/lib/localizer.ts";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repo = JSON.parse(fs.readFileSync(path.join(projectRoot, "public/repos/taxonomy.json"), "utf8"));
const graph = buildGraph(repo);

// The files a run leaves out are every Repo file not in its Slice, so the
// record keeps only the Slice; src/lib/landing-runs.ts rebuilds the rest.
const runs = landingRuns((task) => locate(task, repo, graph)).map((run) => {
  const stored = { ...run };
  delete stored.excluded;
  delete stored.excludedPaths;
  return stored;
});

const outputPath = path.join(projectRoot, "src/lib/landing-runs.json");
fs.writeFileSync(outputPath, `${JSON.stringify({ repo: LANDING_REPO, runs }, null, 2)}\n`);
console.log(`Recorded ${runs.length} runs in ${path.relative(projectRoot, outputPath)}.`);

#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const result = spawnSync(
  "git",
  ["grep", "-n", "-E", "^(<<<<<<< |=======|>>>>>>> )", "--", "."],
  { encoding: "utf8" },
);

if (result.status === 1) {
  console.log("No unresolved merge markers found in tracked files.");
  process.exit(0);
}

if (result.status === 0) {
  process.stderr.write(result.stdout);
  console.error("Unresolved merge markers found. Resolve them before shipping.");
  process.exit(1);
}

process.stderr.write(result.stderr || "Unable to scan tracked files for merge markers.\n");
process.exit(result.status ?? 1);

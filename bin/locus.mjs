#!/usr/bin/env node
// Locus CLI — localize a task to the minimal code slice on a local repo.
import path from "node:path";
import { buildGraph, locate, loadLocalRepo, formatResult, buildPackedContext } from "./core.mjs";

const HELP = `Locus — show your AI coding agent only the code it needs.

Usage:
  locus locate "<task>" [--path .] [--json] [--pack] [--budget <tokens>]
  locus mcp
  locus --help

locate options:
  --path <dir>    Repo directory to analyze (default: current directory)
  --json          Print the machine-readable LocateResult as JSON
  --pack          Print a ready-to-paste context block for the slice
  --budget <n>    Token budget for --pack (default: 40000)

Examples:
  locus locate "fix the dashboard chart" --pack
  locus locate "the graph visualization" --json
  locus mcp   # start the MCP stdio server for Codex/Claude Code/Cursor
`;

function printHelp() {
  process.stdout.write(HELP);
}

function parseLocateArgs(rest) {
  let dir = process.cwd();
  let json = false;
  let pack = false;
  let budget = 40000;
  const positionals = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--path") {
      dir = rest[++i];
    } else if (a === "--json") {
      json = true;
    } else if (a === "--pack") {
      pack = true;
    } else if (a === "--budget") {
      budget = Number(rest[++i]);
    } else if (a === "-h" || a === "--help") {
      printHelp();
      process.exit(0);
    } else {
      positionals.push(a);
    }
  }
  return { task: positionals.join(" "), dir, json, pack, budget };
}

function runLocate(rest) {
  const { task, dir, json, pack, budget } = parseLocateArgs(rest);
  if (!task || !task.trim()) {
    console.error('Usage: locus locate "<task>" [--path .] [--json] [--pack] [--budget <tokens>]');
    process.exit(1);
  }
  const root = path.resolve(dir || ".");
  const repo = loadLocalRepo(root);
  const graph = buildGraph(repo);
  const result = locate(task, repo, graph);

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  if (pack) {
    const packed = buildPackedContext(result, repo, budget);
    console.log(packed.text);
    return;
  }
  console.log(formatResult(result));
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (!cmd || cmd === "--help" || cmd === "-h") {
    printHelp();
    return;
  }
  if (cmd === "mcp") {
    // Running this module runs the server (its listeners attach at import
    // time), so importing it here is equivalent to `node bin/mcp.mjs`.
    await import("./mcp.mjs");
    return;
  }
  if (cmd === "locate") {
    runLocate(args.slice(1));
    return;
  }
  console.error(`Unknown command: ${cmd}\n`);
  printHelp();
  process.exit(1);
}

main();

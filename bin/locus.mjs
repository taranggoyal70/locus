#!/usr/bin/env node
// Locus CLI — localize a task to the minimal code slice on a local repo.
import path from "node:path";
import { buildGraph, locate, loadLocalRepo, formatResult, buildPackedContext, buildJsonResult } from "./core.mjs";

const HELP = `Locus — show your AI coding agent only the code it needs.

Usage:
  locus locate "<task>" [--path .] [--json] [--pack] [--budget <tokens>] [--evidence <text>]
  locus mcp
  locus --help

locate options:
  --path <dir>       Repo directory to analyze (default: current directory)
  --json             Print the machine-readable LocateResult as JSON
  --pack             Print a ready-to-paste context block for the slice
  --budget <n>       Token budget for --pack (default: 40000)
  --evidence <text>  Additional context (error message, stack trace) to improve matching
  --                 End option parsing, for a task that begins with a dash

Examples:
  locus locate "fix the dashboard chart" --pack
  locus locate "the graph visualization" --json
  locus locate "login error" --evidence "TypeError: Cannot read property 'email' of null"
  locus mcp   # start the MCP stdio server for Codex/Claude Code/Cursor
`;

function printHelp() {
  process.stdout.write(HELP);
}

const MIN_BUDGET = 1000;
const MAX_BUDGET = 2000000;

/**
 * Reject what cannot be honoured instead of accepting it silently.
 *
 * The caller is usually an agent, and every one of these was previously a wrong
 * answer with a zero exit status: `--budget abc` became NaN and packed the whole
 * Slice, `--budget 0` packed it too, an unknown flag such as a mistyped `--jsonn`
 * was swallowed so the agent got human-readable text where it expected JSON, and
 * a trailing `--path` with no value silently analysed the working directory.
 *
 * A tool an agent drives has to fail loudly, because an agent cannot notice that
 * the output looks wrong.
 */
function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseBudget(raw) {
  if (raw === undefined) fail("--budget requires a value.");
  if (!/^\d+$/.test(raw)) fail(`--budget must be a whole number of tokens, got: ${raw}`);
  const budget = Number(raw);
  if (budget < MIN_BUDGET || budget > MAX_BUDGET) {
    fail(`--budget must be between ${MIN_BUDGET} and ${MAX_BUDGET}, got: ${budget}`);
  }
  return budget;
}

function parseLocateArgs(rest) {
  let dir = process.cwd();
  let json = false;
  let pack = false;
  let budget = 40000;
  let evidence = "";
  const positionals = [];
  let optionsEnded = false;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    // The conventional terminator, so a task may legitimately begin with a dash:
    //   locus locate -- "--json output is malformed"
    // Without it, rejecting unknown options would make such a task unaskable.
    if (a === "--") {
      optionsEnded = true;
      continue;
    }
    if (optionsEnded) {
      positionals.push(a);
      continue;
    }
    if (a === "--path") {
      const value = rest[++i];
      if (value === undefined) fail("--path requires a directory.");
      dir = value;
    } else if (a === "--json") {
      json = true;
    } else if (a === "--pack") {
      pack = true;
    } else if (a === "--budget") {
      budget = parseBudget(rest[++i]);
    } else if (a === "--evidence") {
      const value = rest[++i];
      if (value === undefined) fail("--evidence requires a value.");
      evidence = value;
    } else if (a === "-h" || a === "--help") {
      printHelp();
      process.exit(0);
    } else if (a.startsWith("-")) {
      fail(`Unknown option: ${a}\n\nRun \`locus --help\` for usage.`);
    } else {
      positionals.push(a);
    }
  }
  return { task: positionals.join(" "), dir, json, pack, budget, evidence };
}

function runLocate(rest) {
  const { task, dir, json, pack, budget, evidence } = parseLocateArgs(rest);
  if (!task || !task.trim()) {
    console.error('Usage: locus locate "<task>" [--path .] [--json] [--pack] [--budget <tokens>] [--evidence <text>]');
    process.exit(1);
  }
  const root = path.resolve(dir || ".");
  let repo;
  try {
    repo = loadLocalRepo(root);
  } catch (cause) {
    fail(cause instanceof Error ? cause.message : String(cause));
  }
  const graph = buildGraph(repo);
  const result = locate(task, repo, graph, evidence);

  if (json) {
    console.log(JSON.stringify(buildJsonResult(result, repo), null, 2));
    return;
  }
  if (pack) {
    const packed = buildPackedContext(result, repo, budget);
    console.log(packed.text);
    return;
  }
  console.log(formatResult(result, repo));
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

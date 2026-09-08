#!/usr/bin/env node
// Locus CLI — localize a task to the minimal code slice on a local repo.
import path from "node:path";
import { buildGraph, locate, loadLocalRepo, formatResult, buildPackedContext, buildJsonResult } from "./core.mjs";
import {
  DEFAULT_SENSITIVE_PATTERNS,
  createScopeManifest,
  readGitHead,
  readGitIdentity,
  readJsonFile,
  verifyGitCandidate,
  widenScopeManifest,
  writeJsonFile,
} from "./guard.mjs";

const HELP = `Locus — show your AI coding agent only the code it needs.

Usage:
  locus locate "<task>" [--path .] [--json] [--pack] [--budget <tokens>] [--evidence <text>]
  locus guard init "<task>" [--path .] [--out .locus/scope.json]
  locus guard widen <repo-path> --reason "<why>" --actor "<who>" [--manifest .locus/scope.json]
  locus guard verify --expected-manifest-hash <sha256> [--path .] [--manifest .locus/scope.json]
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
  locus guard init "fix duplicate invoice retries" --task-id BILL-142
  locus guard verify --expected-manifest-hash "$LOCUS_GUARD_MANIFEST_HASH"
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

function parseGuardInitArgs(rest) {
  let dir = ".";
  let out = ".locus/scope.json";
  let taskId = null;
  let actor = "local-user";
  let evidence = "";
  let allowWholeRepo = false;
  const sensitivePatterns = [...DEFAULT_SENSITIVE_PATTERNS];
  const positionals = [];
  let optionsEnded = false;
  for (let index = 0; index < rest.length; index++) {
    const arg = rest[index];
    if (arg === "--") {
      optionsEnded = true;
      continue;
    }
    if (optionsEnded) {
      positionals.push(arg);
    } else if (["--path", "--out", "--task-id", "--actor", "--evidence", "--sensitive"].includes(arg)) {
      const value = rest[++index];
      if (value === undefined) fail(`${arg} requires a value.`);
      if (arg === "--path") dir = value;
      if (arg === "--out") out = value;
      if (arg === "--task-id") taskId = value;
      if (arg === "--actor") actor = value;
      if (arg === "--evidence") evidence = value;
      if (arg === "--sensitive") sensitivePatterns.push(value);
    } else if (arg === "--allow-whole-repo") {
      allowWholeRepo = true;
    } else if (arg.startsWith("-")) {
      fail(`Unknown guard init option: ${arg}`);
    } else {
      positionals.push(arg);
    }
  }
  return {
    task: positionals.join(" "), dir, out, taskId, actor, evidence, allowWholeRepo, sensitivePatterns,
  };
}

function runGuardInit(rest) {
  const options = parseGuardInitArgs(rest);
  if (!options.task.trim()) fail('Usage: locus guard init "<task>" [--path .] [--out .locus/scope.json]');
  const root = path.resolve(options.dir);
  let repo;
  try {
    repo = loadLocalRepo(root);
  } catch (cause) {
    fail(cause instanceof Error ? cause.message : String(cause));
  }
  const result = locate(options.task, repo, buildGraph(repo), options.evidence);
  if (result.widened && !options.allowWholeRepo) {
    const detail = result.refinement?.unmatchedTerms?.length
      ? ` Unmatched terms: ${result.refinement.unmatchedTerms.join(", ")}.`
      : "";
    fail(
      `Locus could not derive a focused Slice, so Guard refused a whole-Repo manifest.${detail} Refine the task or pass --allow-whole-repo explicitly.`,
    );
  }
  let manifest;
  try {
    manifest = createScopeManifest({
      task: options.task,
      taskId: options.taskId,
      repository: readGitIdentity(root),
      baseSha: readGitHead(root),
      admittedPaths: result.slice.map((file) => file.path),
      excludedPaths: result.excludedPaths,
      sensitivePatterns: options.sensitivePatterns,
      actor: options.actor,
    });
  } catch (cause) {
    fail(cause instanceof Error ? cause.message : String(cause));
  }
  const output = writeJsonFile(path.resolve(root, options.out), manifest);
  console.log(`Guard manifest ${manifest.manifestHash} wrote ${output}`);
  console.log(`Admitted ${manifest.scope.admittedPaths.length}; excluded ${manifest.scope.excludedPaths.length}; base ${manifest.repository.baseSha}.`);
}

function parseGuardWidenArgs(rest) {
  const positionals = [];
  let manifest = ".locus/scope.json";
  let out = null;
  let reason = "";
  let actor = "";
  let decision = "approved";
  let allowSensitive = false;
  for (let index = 0; index < rest.length; index++) {
    const arg = rest[index];
    if (["--manifest", "--out", "--reason", "--actor"].includes(arg)) {
      const value = rest[++index];
      if (value === undefined) fail(`${arg} requires a value.`);
      if (arg === "--manifest") manifest = value;
      if (arg === "--out") out = value;
      if (arg === "--reason") reason = value;
      if (arg === "--actor") actor = value;
    } else if (arg === "--deny") {
      decision = "denied";
    } else if (arg === "--allow-sensitive") {
      allowSensitive = true;
    } else if (arg.startsWith("-")) {
      fail(`Unknown guard widen option: ${arg}`);
    } else {
      positionals.push(arg);
    }
  }
  return { repoPath: positionals.join(" "), manifest, out, reason, actor, decision, allowSensitive };
}

function runGuardWiden(rest) {
  const options = parseGuardWidenArgs(rest);
  if (!options.repoPath || !options.reason || !options.actor) {
    fail('Usage: locus guard widen <repo-path> --reason "<why>" --actor "<who>" [--manifest .locus/scope.json]');
  }
  const manifestPath = path.resolve(options.manifest);
  try {
    const current = readJsonFile(manifestPath, "Guard manifest");
    const next = widenScopeManifest(current, options);
    const output = writeJsonFile(options.out ? path.resolve(options.out) : manifestPath, next);
    const event = next.widens.at(-1);
    console.log(`Widen ${event.decision}: ${event.path}`);
    console.log(`Event ${event.eventHash}; manifest ${next.manifestHash}; wrote ${output}`);
  } catch (cause) {
    fail(cause instanceof Error ? cause.message : String(cause));
  }
}

function parseGuardVerifyArgs(rest) {
  let dir = ".";
  let manifest = ".locus/scope.json";
  let receipt = ".locus/receipt.json";
  let json = false;
  let expectedManifestHash = process.env.LOCUS_GUARD_MANIFEST_HASH ?? null;
  let advisory = false;
  for (let index = 0; index < rest.length; index++) {
    const arg = rest[index];
    if (["--path", "--manifest", "--receipt", "--expected-manifest-hash"].includes(arg)) {
      const value = rest[++index];
      if (value === undefined) fail(`${arg} requires a value.`);
      if (arg === "--path") dir = value;
      if (arg === "--manifest") manifest = value;
      if (arg === "--receipt") receipt = value;
      if (arg === "--expected-manifest-hash") expectedManifestHash = value;
    } else if (arg === "--json") {
      json = true;
    } else if (arg === "--advisory") {
      advisory = true;
    } else {
      fail(`Unknown guard verify option: ${arg}`);
    }
  }
  return { dir, manifest, receipt, json, expectedManifestHash, advisory };
}

function runGuardVerify(rest) {
  const options = parseGuardVerifyArgs(rest);
  const root = path.resolve(options.dir);
  let receipt;
  try {
    const manifest = readJsonFile(path.resolve(root, options.manifest), "Guard manifest");
    receipt = verifyGitCandidate({
      manifest,
      repoDir: root,
      expectedManifestHash: options.expectedManifestHash,
      advisory: options.advisory,
    });
    writeJsonFile(path.resolve(root, options.receipt), receipt);
  } catch (cause) {
    fail(cause instanceof Error ? cause.message : String(cause));
  }
  if (options.json) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log(`Locus Guard ${receipt.enforcement.result.toUpperCase()}: ${receipt.candidate.hash}`);
    console.log(`Changed ${receipt.candidate.changedPaths.length} path(s); ${receipt.violations.length} violation(s).`);
    console.log(`Receipt ${receipt.receiptHash} wrote ${path.resolve(root, options.receipt)}`);
    for (const violation of receipt.violations) console.error(`- ${violation.message}`);
  }
  if (receipt.enforcement.result !== "pass") process.exitCode = 1;
}

function runGuard(rest) {
  const subcommand = rest[0];
  if (subcommand === "init") return runGuardInit(rest.slice(1));
  if (subcommand === "widen") return runGuardWiden(rest.slice(1));
  if (subcommand === "verify") return runGuardVerify(rest.slice(1));
  fail("Usage: locus guard <init|widen|verify> ...");
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
  if (cmd === "guard") {
    runGuard(args.slice(1));
    return;
  }
  console.error(`Unknown command: ${cmd}\n`);
  printHelp();
  process.exit(1);
}

main();

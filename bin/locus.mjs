#!/usr/bin/env node
// Locus CLI — localize a task to the minimal code slice on a local repo.
import path from "node:path";
import { buildGraph, locate, loadLocalRepo, formatResult, buildPackedContext, buildJsonResult } from "./core.mjs";
import {
  DEFAULT_SENSITIVE_PATTERNS,
  assertCleanGitCheckout,
  createScopeManifest,
  readGitHead,
  readGitIdentity,
  readJsonFile,
  sha256,
  verifyGitCandidate,
  widenScopeManifest,
  writeJsonFile,
} from "./guard.mjs";
import {
  createSignedEnvelope,
  generateSigningKeyPair,
  verifySignedEnvelope,
} from "./guard-signing.mjs";
import { runGuardedAgent } from "./guard-runner.mjs";
import { addHumanReview } from "./guard-review.mjs";

const HELP = `Locus — show your AI coding agent only the code it needs.

Usage:
  locus locate "<task>" [--path .] [--json] [--pack] [--budget <tokens>] [--evidence <text>]
  locus guard init "<task>" [--path .] [--out .locus/scope.json]
  locus guard widen <repo-path> --reason "<why>" --actor "<who>" [--manifest .locus/scope.json]
  locus guard verify --expected-manifest-hash <sha256> --expected-candidate-sha <git-oid> [--path .]
  locus guard keygen --private-key <path> --public-key <path>
  locus guard run --agent <codex|claude|command> --expected-manifest-hash <sha256> --signing-key <path> [--prompt "<task>"] [--check "<command>"]
  locus guard review --decision <accepted|rejected> --actor <who> --criterion <result> --signing-key <path> --public-key <path>
  locus guard receipt verify --receipt .locus/run-receipt.json --public-key <path> [--expected-key-id <sha256>]
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
  locus guard run --agent codex --prompt "fix duplicate invoice retries" --check "pnpm test"
  locus guard verify --expected-manifest-hash "$LOCUS_GUARD_MANIFEST_HASH" --expected-candidate-sha "$GITHUB_HEAD_SHA"
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
    } else if (arg.startsWith("-")) {
      fail(`Unknown guard init option: ${arg}`);
    } else {
      positionals.push(arg);
    }
  }
  return {
    task: positionals.join(" "), dir, out, taskId, actor, evidence, sensitivePatterns,
  };
}

function runGuardInit(rest) {
  const options = parseGuardInitArgs(rest);
  if (!options.task.trim()) fail('Usage: locus guard init "<task>" [--path .] [--out .locus/scope.json]');
  const root = path.resolve(options.dir);
  const outputPath = path.resolve(root, options.out);
  const outputRelative = path.relative(root, outputPath).split(path.sep).join("/");
  const outputIsInside = outputRelative && outputRelative !== ".." && !outputRelative.startsWith("../");
  if (outputIsInside && !outputRelative.startsWith(".locus/")) {
    fail("Guard control artifacts inside the Repo must be written under .locus/.");
  }
  let baseSha;
  try {
    assertCleanGitCheckout(root, outputIsInside ? [outputRelative] : []);
    baseSha = readGitHead(root);
  } catch (cause) {
    fail(cause instanceof Error ? cause.message : String(cause));
  }
  let repo;
  try {
    repo = loadLocalRepo(root);
  } catch (cause) {
    fail(cause instanceof Error ? cause.message : String(cause));
  }
  const result = locate(options.task, repo, buildGraph(repo), options.evidence);
  if (result.widened) {
    const detail = result.refinement?.unmatchedTerms?.length
      ? ` Unmatched terms: ${result.refinement.unmatchedTerms.join(", ")}.`
      : "";
    fail(
      `Locus could not derive a focused Slice, so Guard refused a whole-Repo manifest.${detail} Refine the task with a filename, symbol, error, or repository term.`,
    );
  }
  let manifest;
  try {
    manifest = createScopeManifest({
      task: options.task,
      taskId: options.taskId,
      repository: readGitIdentity(root),
      baseSha,
      admittedPaths: result.slice.map((file) => file.path),
      excludedPaths: result.excludedPaths,
      sensitivePatterns: options.sensitivePatterns,
      taskEvidence: options.evidence ? [{
        kind: "text",
        digest: sha256(options.evidence),
        byteLength: Buffer.byteLength(options.evidence),
      }] : [],
      inclusionReasons: result.slice.map((file) => ({
        path: file.path,
        reasons: [
          result.anchorPaths.includes(file.path) ? "task Anchor" : `dependency distance ${file.dist}`,
          ...(file.recent ? ["Recent signal"] : []),
        ],
      })),
      actor: options.actor,
    });
  } catch (cause) {
    fail(cause instanceof Error ? cause.message : String(cause));
  }
  try {
    assertCleanGitCheckout(root, outputIsInside ? [outputRelative] : []);
  } catch (cause) {
    fail(cause instanceof Error ? cause.message : String(cause));
  }
  if (readGitHead(root) !== baseSha) fail("Repo HEAD changed while Guard was deriving the manifest.");
  const output = writeJsonFile(outputPath, manifest, {
    allowedRoot: outputIsInside ? root : null,
  });
  console.log(`Guard scope manifest ${manifest.manifestHash} wrote ${output}`);
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
  let evidence = "";
  for (let index = 0; index < rest.length; index++) {
    const arg = rest[index];
    if (["--manifest", "--out", "--reason", "--actor", "--evidence"].includes(arg)) {
      const value = rest[++index];
      if (value === undefined) fail(`${arg} requires a value.`);
      if (arg === "--manifest") manifest = value;
      if (arg === "--out") out = value;
      if (arg === "--reason") reason = value;
      if (arg === "--actor") actor = value;
      if (arg === "--evidence") evidence = value;
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
  return {
    repoPath: positionals.join(" "),
    manifest,
    out,
    reason,
    actor,
    decision,
    allowSensitive,
    evidence: evidence ? [{
      kind: "text",
      digest: sha256(evidence),
      byteLength: Buffer.byteLength(evidence),
    }] : [],
  };
}

function runGuardWiden(rest) {
  const options = parseGuardWidenArgs(rest);
  if (!options.repoPath || !options.reason || !options.actor) {
    fail('Usage: locus guard widen <repo-path> --reason "<why>" --actor "<who>" [--manifest .locus/scope.json]');
  }
  const manifestPath = path.resolve(options.manifest);
  try {
    const current = readJsonFile(manifestPath, "Guard scope manifest");
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
  let expectedCandidateSha = process.env.LOCUS_GUARD_CANDIDATE_SHA ?? null;
  let advisory = false;
  for (let index = 0; index < rest.length; index++) {
    const arg = rest[index];
    if (["--path", "--manifest", "--receipt", "--expected-manifest-hash", "--expected-candidate-sha"].includes(arg)) {
      const value = rest[++index];
      if (value === undefined) fail(`${arg} requires a value.`);
      if (arg === "--path") dir = value;
      if (arg === "--manifest") manifest = value;
      if (arg === "--receipt") receipt = value;
      if (arg === "--expected-manifest-hash") expectedManifestHash = value;
      if (arg === "--expected-candidate-sha") expectedCandidateSha = value;
    } else if (arg === "--json") {
      json = true;
    } else if (arg === "--advisory") {
      advisory = true;
    } else {
      fail(`Unknown guard verify option: ${arg}`);
    }
  }
  return { dir, manifest, receipt, json, expectedManifestHash, expectedCandidateSha, advisory };
}

function runGuardVerify(rest) {
  const options = parseGuardVerifyArgs(rest);
  const root = path.resolve(options.dir);
  const manifestPath = path.resolve(root, options.manifest);
  const receiptPath = path.resolve(root, options.receipt);
  const artifactPaths = [manifestPath, receiptPath]
    .map((artifact) => path.relative(root, artifact).split(path.sep).join("/"))
    .filter((artifact) => artifact && artifact !== ".." && !artifact.startsWith("../"));
  for (const artifact of artifactPaths) {
    if (!artifact.startsWith(".locus/")) {
      fail("Guard control artifacts inside the Repo must be stored under .locus/.");
    }
  }
  let receipt;
  try {
    const manifest = readJsonFile(manifestPath, "Guard scope manifest");
    receipt = verifyGitCandidate({
      manifest,
      repoDir: root,
      expectedManifestHash: options.expectedManifestHash,
      expectedCandidateSha: options.expectedCandidateSha,
      advisory: options.advisory,
      allowedUntrackedPaths: artifactPaths,
    });
    writeJsonFile(receiptPath, receipt, {
      allowedRoot: artifactPaths.includes(path.relative(root, receiptPath).split(path.sep).join("/"))
        ? root
        : null,
    });
  } catch (cause) {
    fail(cause instanceof Error ? cause.message : String(cause));
  }
  if (options.json) {
    console.log(JSON.stringify(receipt, null, 2));
  } else {
    console.log(`Locus Guard ${receipt.enforcement.result.toUpperCase()}: ${receipt.candidate.hash}`);
    console.log(`Changed ${receipt.candidate.changedPaths.length} path(s); ${receipt.violations.length} violation(s).`);
    console.log(`Receipt ${receipt.receiptHash} wrote ${receiptPath}`);
    for (const violation of receipt.violations) console.error(`- ${violation.message}`);
  }
  if (receipt.enforcement.result !== "pass") process.exitCode = 1;
}

function pathIsInside(root, target) {
  const relative = path.relative(root, target);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`));
}

function requireControlArtifactPath(repoRoot, artifactPath) {
  const relative = path.relative(repoRoot, artifactPath).split(path.sep).join("/");
  if (relative && relative !== ".." && !relative.startsWith("../") && !relative.startsWith(".locus/")) {
    fail("Guard control artifacts inside the Repo must be stored under .locus/.");
  }
  return relative;
}

function parseGuardKeygenArgs(rest) {
  let repoDir = ".";
  let privateKey = null;
  let publicKey = null;
  let json = false;
  for (let index = 0; index < rest.length; index++) {
    const arg = rest[index];
    if (["--path", "--private-key", "--public-key"].includes(arg)) {
      const value = rest[++index];
      if (value === undefined) fail(`${arg} requires a value.`);
      if (arg === "--path") repoDir = value;
      if (arg === "--private-key") privateKey = value;
      if (arg === "--public-key") publicKey = value;
    } else if (arg === "--json") {
      json = true;
    } else {
      fail(`Unknown guard keygen option: ${arg}`);
    }
  }
  return { repoDir, privateKey, publicKey, json };
}

function runGuardKeygen(rest) {
  const options = parseGuardKeygenArgs(rest);
  if (!options.privateKey || !options.publicKey) {
    fail("Usage: locus guard keygen --private-key <path> --public-key <path>");
  }
  const repoRoot = path.resolve(options.repoDir);
  const privateKeyPath = path.resolve(options.privateKey);
  const publicKeyPath = path.resolve(options.publicKey);
  if (pathIsInside(repoRoot, privateKeyPath)) {
    fail("Guard signing private keys must be stored outside the target Repo.");
  }
  let result;
  try {
    result = generateSigningKeyPair({ privateKeyPath, publicKeyPath });
  } catch (cause) {
    fail(cause instanceof Error ? cause.message : String(cause));
  }
  if (options.json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`Generated Guard Ed25519 key ${result.keyId}.`);
    console.log(`Private ${result.privateKeyPath}; public ${result.publicKeyPath}.`);
  }
}

function parseGuardRunArgs(rest) {
  let repoDir = ".";
  let manifest = ".locus/scope.json";
  let receipt = ".locus/run-receipt.json";
  let expectedManifestHash = process.env.LOCUS_GUARD_MANIFEST_HASH ?? null;
  let signingKey = process.env.LOCUS_GUARD_SIGNING_KEY ?? null;
  let agent = null;
  let prompt = "";
  let model = null;
  let json = false;
  const checks = [];
  const commandArgv = [];
  let optionsEnded = false;
  for (let index = 0; index < rest.length; index++) {
    const arg = rest[index];
    if (arg === "--") {
      optionsEnded = true;
      continue;
    }
    if (optionsEnded) {
      commandArgv.push(arg);
      continue;
    }
    if ([
      "--path", "--manifest", "--receipt", "--expected-manifest-hash",
      "--signing-key", "--agent", "--prompt", "--model", "--check",
    ].includes(arg)) {
      const value = rest[++index];
      if (value === undefined) fail(`${arg} requires a value.`);
      if (arg === "--path") repoDir = value;
      if (arg === "--manifest") manifest = value;
      if (arg === "--receipt") receipt = value;
      if (arg === "--expected-manifest-hash") expectedManifestHash = value;
      if (arg === "--signing-key") signingKey = value;
      if (arg === "--agent") agent = value;
      if (arg === "--prompt") prompt = value;
      if (arg === "--model") model = value;
      if (arg === "--check") checks.push(value);
    } else if (arg === "--json") {
      json = true;
    } else {
      fail(`Unknown guard run option: ${arg}`);
    }
  }
  return {
    repoDir, manifest, receipt, expectedManifestHash, signingKey,
    agent, prompt, model, checks, commandArgv, json,
  };
}

async function runGuardAgent(rest) {
  const options = parseGuardRunArgs(rest);
  if (!options.agent || !["codex", "claude", "command"].includes(options.agent)) {
    fail("Guard Run requires --agent codex, --agent claude, or --agent command.");
  }
  if (!options.signingKey) fail("Guard Run requires --signing-key or LOCUS_GUARD_SIGNING_KEY.");
  const repoRoot = path.resolve(options.repoDir);
  const manifestPath = path.resolve(repoRoot, options.manifest);
  const receiptPath = path.resolve(repoRoot, options.receipt);
  const signingKeyPath = path.resolve(options.signingKey);
  requireControlArtifactPath(repoRoot, manifestPath);
  const receiptRelative = requireControlArtifactPath(repoRoot, receiptPath);
  if (pathIsInside(repoRoot, signingKeyPath)) {
    fail("Guard signing private keys must be stored outside the target Repo.");
  }
  let receipt;
  let envelope;
  try {
    const manifest = readJsonFile(manifestPath, "Guard scope manifest");
    receipt = await runGuardedAgent({
      manifest,
      repoDir: repoRoot,
      expectedManifestHash: options.expectedManifestHash,
      agent: options.agent,
      prompt: options.prompt || manifest.task.description,
      model: options.model,
      commandArgv: options.commandArgv,
      checks: options.checks,
    });
    envelope = createSignedEnvelope({ payload: receipt, privateKeyPath: signingKeyPath });
    writeJsonFile(receiptPath, envelope, {
      allowedRoot: receiptRelative && !receiptRelative.startsWith("../") ? repoRoot : null,
    });
  } catch (cause) {
    fail(cause instanceof Error ? cause.message : String(cause));
  }
  if (options.json) console.log(JSON.stringify(envelope, null, 2));
  else {
    console.log(`Locus Guard Run ${receipt.enforcement.result.toUpperCase()}: ${receipt.candidate.hash}`);
    console.log(`Receipt ${receipt.receiptHash} signed by ${envelope.signature.keyId}.`);
  }
  for (const violation of receipt.violations) console.error(`- ${violation.message}`);
  if (receipt.enforcement.result !== "pass") process.exitCode = 1;
}

function parseGuardReceiptVerifyArgs(rest) {
  let receipt = ".locus/run-receipt.json";
  let publicKey = null;
  let expectedKeyId = process.env.LOCUS_GUARD_SIGNER_KEY_ID ?? null;
  let json = false;
  for (let index = 0; index < rest.length; index++) {
    const arg = rest[index];
    if (["--receipt", "--public-key", "--expected-key-id"].includes(arg)) {
      const value = rest[++index];
      if (value === undefined) fail(`${arg} requires a value.`);
      if (arg === "--receipt") receipt = value;
      if (arg === "--public-key") publicKey = value;
      if (arg === "--expected-key-id") expectedKeyId = value;
    } else if (arg === "--json") {
      json = true;
    } else {
      fail(`Unknown guard receipt verify option: ${arg}`);
    }
  }
  return { receipt, publicKey, expectedKeyId, json };
}

function runGuardReceiptVerify(rest) {
  if (rest[0] !== "verify") fail("Usage: locus guard receipt verify --public-key <path>");
  const options = parseGuardReceiptVerifyArgs(rest.slice(1));
  if (!options.publicKey) fail("Guard receipt verification requires --public-key.");
  let payload;
  try {
    const envelope = readJsonFile(path.resolve(options.receipt), "Guard signed receipt");
    payload = verifySignedEnvelope({
      envelope,
      publicKeyPath: path.resolve(options.publicKey),
      expectedKeyId: options.expectedKeyId,
    });
  } catch (cause) {
    fail(cause instanceof Error ? cause.message : String(cause));
  }
  if (options.json) console.log(JSON.stringify(payload, null, 2));
  else console.log(`Verified signed Guard receipt ${payload.receiptHash}.`);
}

function parseGuardReviewArgs(rest) {
  let repoDir = ".";
  let receipt = ".locus/run-receipt.json";
  let out = null;
  let publicKey = null;
  let signingKey = process.env.LOCUS_GUARD_SIGNING_KEY ?? null;
  let decision = null;
  let actor = null;
  let note = null;
  let json = false;
  const criteria = [];
  for (let index = 0; index < rest.length; index++) {
    const arg = rest[index];
    if ([
      "--path", "--receipt", "--out", "--public-key", "--signing-key",
      "--decision", "--actor", "--criterion", "--note",
    ].includes(arg)) {
      const value = rest[++index];
      if (value === undefined) fail(`${arg} requires a value.`);
      if (arg === "--path") repoDir = value;
      if (arg === "--receipt") receipt = value;
      if (arg === "--out") out = value;
      if (arg === "--public-key") publicKey = value;
      if (arg === "--signing-key") signingKey = value;
      if (arg === "--decision") decision = value;
      if (arg === "--actor") actor = value;
      if (arg === "--criterion") criteria.push(value);
      if (arg === "--note") note = value;
    } else if (arg === "--json") {
      json = true;
    } else {
      fail(`Unknown guard review option: ${arg}`);
    }
  }
  return {
    repoDir, receipt, out, publicKey, signingKey, decision, actor, criteria, note, json,
  };
}

function runGuardReview(rest) {
  const options = parseGuardReviewArgs(rest);
  if (!options.publicKey || !options.signingKey || !options.decision || !options.actor) {
    fail(
      "Guard Review requires --public-key, --signing-key, --decision, --actor, and --criterion.",
    );
  }
  const repoRoot = path.resolve(options.repoDir);
  const receiptPath = path.resolve(repoRoot, options.receipt);
  const outputPath = path.resolve(repoRoot, options.out ?? options.receipt);
  const signingKeyPath = path.resolve(options.signingKey);
  requireControlArtifactPath(repoRoot, receiptPath);
  const outputRelative = requireControlArtifactPath(repoRoot, outputPath);
  if (pathIsInside(repoRoot, signingKeyPath)) {
    fail("Guard signing private keys must be stored outside the target Repo.");
  }
  let reviewed;
  let nextEnvelope;
  try {
    const envelope = readJsonFile(receiptPath, "Guard signed receipt");
    const receipt = verifySignedEnvelope({
      envelope,
      publicKeyPath: path.resolve(options.publicKey),
      expectedKeyId: envelope.signature?.keyId,
    });
    reviewed = addHumanReview(receipt, {
      decision: options.decision,
      actor: options.actor,
      criteria: options.criteria,
      note: options.note,
    });
    nextEnvelope = createSignedEnvelope({ payload: reviewed, privateKeyPath: signingKeyPath });
    if (nextEnvelope.signature.keyId !== envelope.signature.keyId) {
      throw new Error("Guard Review must be signed by the same trusted key as the proposal.");
    }
    writeJsonFile(outputPath, nextEnvelope, {
      allowedRoot: outputRelative && !outputRelative.startsWith("../") ? repoRoot : null,
    });
  } catch (cause) {
    fail(cause instanceof Error ? cause.message : String(cause));
  }
  if (options.json) console.log(JSON.stringify(nextEnvelope, null, 2));
  else {
    console.log(`Human Review ${reviewed.review.status}: ${reviewed.receiptHash}.`);
    console.log(`Proposal ${reviewed.review.proposalHash}; signer ${nextEnvelope.signature.keyId}.`);
  }
}

async function runGuard(rest) {
  const subcommand = rest[0];
  if (subcommand === "init") return runGuardInit(rest.slice(1));
  if (subcommand === "widen") return runGuardWiden(rest.slice(1));
  if (subcommand === "verify") return runGuardVerify(rest.slice(1));
  if (subcommand === "keygen") return runGuardKeygen(rest.slice(1));
  if (subcommand === "run") return runGuardAgent(rest.slice(1));
  if (subcommand === "review") return runGuardReview(rest.slice(1));
  if (subcommand === "receipt") return runGuardReceiptVerify(rest.slice(1));
  fail("Usage: locus guard <init|widen|verify|keygen|run|review|receipt> ...");
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
    await runGuard(args.slice(1));
    return;
  }
  console.error(`Unknown command: ${cmd}\n`);
  printHelp();
  process.exit(1);
}

main();

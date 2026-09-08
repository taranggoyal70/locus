import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import {
  GUARD_VERSION,
  assertCleanGitCheckout,
  canonicalJson,
  normalizeRepoPath,
  readGitHead,
  readGitIdentity,
  sha256,
  verifyScopeManifest,
  writeFileSafely,
} from "./guard.mjs";

export const GUARD_RUN_RECEIPT_SCHEMA = "locus.guard.run-receipt.v1";
const MAX_EVIDENCE_OUTPUT_BYTES = 8_000;
const MAX_CANDIDATE_FILE_BYTES = 16 * 1024 * 1024;

function isInside(root, target) {
  const relative = path.relative(root, target);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`));
}

function findExecutable(name, searchPath = process.env.PATH ?? "") {
  if (name.includes(path.sep)) {
    const absolute = path.resolve(name);
    try {
      fs.accessSync(absolute, fs.constants.X_OK);
      return absolute;
    } catch {
      return null;
    }
  }
  for (const directory of searchPath.split(path.delimiter).filter(Boolean)) {
    const candidate = path.join(directory, name);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      // Keep searching PATH.
    }
  }
  return null;
}

function inspectRegularFile(filePath, label) {
  let stat;
  try {
    stat = fs.lstatSync(filePath);
  } catch {
    throw new Error(`${label} is missing: ${filePath}`);
  }
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new Error(`${label} must be a regular file: ${filePath}`);
  }
  if (stat.size > MAX_CANDIDATE_FILE_BYTES) {
    throw new Error(`${label} exceeds ${MAX_CANDIDATE_FILE_BYTES} bytes: ${filePath}`);
  }
  return stat;
}

function originalPath(repoRoot, repoPath) {
  const target = path.resolve(repoRoot, normalizeRepoPath(repoPath));
  if (!isInside(repoRoot, target)) throw new Error(`Guard path escapes the Repo: ${repoPath}`);
  return target;
}

function materializeSlice({ repoRoot, workspace, admittedPaths }) {
  const baseline = new Map();
  for (const repoPath of admittedPaths) {
    const source = originalPath(repoRoot, repoPath);
    const stat = inspectRegularFile(source, "Admitted Slice path");
    const contents = fs.readFileSync(source);
    const target = path.join(workspace, repoPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents, { mode: stat.mode & 0o777 });
    baseline.set(repoPath, {
      contents,
      executable: Boolean(stat.mode & 0o111),
    });
  }
  return baseline;
}

function walkWorkspace(directory, prefix = "") {
  const entries = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const repoPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      entries.push(...walkWorkspace(absolute, repoPath));
    } else {
      const stat = fs.lstatSync(absolute);
      entries.push({ repoPath: normalizeRepoPath(repoPath), absolute, stat });
    }
  }
  return entries;
}

function inspectWorkspaceCandidate({ workspace, baseline, admittedPaths }) {
  const admitted = new Set(admittedPaths);
  const violations = [];
  const current = new Map();
  for (const entry of walkWorkspace(workspace)) {
    if (!admitted.has(entry.repoPath)) {
      violations.push({
        code: "PATH_OUTSIDE_SCOPE",
        path: entry.repoPath,
        message: `${entry.repoPath} was created outside the admitted Slice.`,
      });
      continue;
    }
    if (entry.stat.isSymbolicLink() || !entry.stat.isFile()) {
      violations.push({
        code: "UNSAFE_FILE_TYPE",
        path: entry.repoPath,
        message: `${entry.repoPath} is not a regular file.`,
      });
      continue;
    }
    if (entry.stat.size > MAX_CANDIDATE_FILE_BYTES) {
      violations.push({
        code: "FILE_TOO_LARGE",
        path: entry.repoPath,
        message: `${entry.repoPath} exceeds ${MAX_CANDIDATE_FILE_BYTES} bytes.`,
      });
      continue;
    }
    current.set(entry.repoPath, {
      contents: fs.readFileSync(entry.absolute),
      executable: Boolean(entry.stat.mode & 0o111),
    });
  }

  const records = [];
  for (const repoPath of [...admitted].sort()) {
    const before = baseline.get(repoPath);
    const after = current.get(repoPath);
    if (!after) {
      records.push({ path: repoPath, state: "deleted", byteLength: 0, contentHash: null });
      continue;
    }
    if (before.contents.equals(after.contents) && before.executable === after.executable) continue;
    records.push({
      path: repoPath,
      state: "modified",
      byteLength: after.contents.byteLength,
      contentHash: sha256(after.contents),
      executable: after.executable,
    });
  }
  if (records.length === 0) {
    violations.push({
      code: "EMPTY_CANDIDATE",
      path: null,
      message: "The contained agent produced no admitted file changes.",
    });
  }
  return {
    records,
    changedPaths: records.map((record) => record.path),
    hashAlgorithm: "sha256-canonical-content-records",
    hash: sha256(canonicalJson(records)),
    violations,
    current,
  };
}

function copyProviderCredentials(agent, runtimeHome) {
  if (agent === "codex") {
    const sourceHome = process.env.CODEX_HOME
      ? path.resolve(process.env.CODEX_HOME)
      : path.join(os.homedir(), ".codex");
    const source = path.join(sourceHome, "auth.json");
    if (fs.existsSync(source)) {
      const destination = path.join(runtimeHome, ".codex", "auth.json");
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(source, destination);
      fs.chmodSync(destination, 0o600);
    }
    return;
  }
  if (agent === "claude") {
    const candidates = [
      [path.join(os.homedir(), ".claude.json"), path.join(runtimeHome, ".claude.json")],
      [
        path.join(os.homedir(), ".claude", ".credentials.json"),
        path.join(runtimeHome, ".claude", ".credentials.json"),
      ],
    ];
    for (const [source, destination] of candidates) {
      if (!fs.existsSync(source)) continue;
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(source, destination);
      fs.chmodSync(destination, 0o600);
    }
  }
}

function agentInvocation({ agent, prompt, model, commandArgv, workspaceView }) {
  if (agent === "command") {
    if (!Array.isArray(commandArgv) || commandArgv.length === 0) {
      throw new Error("The command adapter requires argv after --.");
    }
    const executable = findExecutable(commandArgv[0]);
    if (!executable) throw new Error(`Agent command is not executable: ${commandArgv[0]}`);
    return { executable, args: commandArgv.slice(1), version: null };
  }
  if (!prompt?.trim()) throw new Error(`The ${agent} adapter requires --prompt.`);
  const executable = findExecutable(agent);
  if (!executable) throw new Error(`${agent} is not installed or is not on PATH.`);
  const versionResult = spawnSync(executable, ["--version"], { encoding: "utf8" });
  const version = versionResult.status === 0 ? versionResult.stdout.trim() : null;
  if (agent === "codex") {
    return {
      executable,
      args: [
        "exec", "--json", "--sandbox", "workspace-write", "--skip-git-repo-check",
        "--cd", workspaceView,
        ...(model ? ["--model", model] : []),
        prompt,
      ],
      version,
    };
  }
  if (agent === "claude") {
    return {
      executable,
      args: [
        "--print", "--output-format", "json", "--verbose", "--safe-mode",
        "--no-session-persistence", "--permission-mode", "bypassPermissions",
        ...(model ? ["--model", model] : []),
        prompt,
      ],
      version,
    };
  }
  throw new Error(`Unsupported Guard agent adapter: ${agent}`);
}

function seatbeltProfile({ repoRoot, ephemeralRoot }) {
  const repo = JSON.stringify(path.resolve(repoRoot));
  const runtime = JSON.stringify(path.resolve(ephemeralRoot));
  return [
    "(version 1)",
    "(deny default)",
    "(allow process*)",
    "(allow network*)",
    "(allow sysctl-read)",
    "(allow mach-lookup)",
    "(allow signal)",
    "(allow ipc-posix*)",
    "(allow file-read*)",
    `(deny file-read* (subpath ${repo}))`,
    `(allow file-write* (subpath ${runtime}))`,
    '(allow file-write* (literal "/dev/null") (literal "/dev/tty"))',
  ].join("\n");
}

function sandboxInvocation({ repoRoot, ephemeralRoot, workspace, runtimeHome, invocation }) {
  if (process.platform === "darwin") {
    const sandboxExecutable = findExecutable("sandbox-exec");
    if (!sandboxExecutable) {
      throw new Error("Guard refused to run because macOS Seatbelt is unavailable.");
    }
    return {
      backend: "macos-seatbelt",
      executable: sandboxExecutable,
      args: [
        "-p",
        seatbeltProfile({ repoRoot, ephemeralRoot }),
        invocation.executable,
        ...invocation.args,
      ],
      cwd: workspace,
      workspaceView: workspace,
      runtimeHomeView: runtimeHome,
    };
  }
  if (process.platform === "linux") {
    const bubblewrap = findExecutable("bwrap");
    if (!bubblewrap) {
      throw new Error("Guard refused to run because Linux Bubblewrap is unavailable.");
    }
    return {
      backend: "linux-bubblewrap",
      executable: bubblewrap,
      args: [
        "--die-with-parent", "--new-session", "--unshare-pid", "--unshare-uts",
        "--unshare-ipc", "--share-net", "--ro-bind", "/", "/",
        "--tmpfs", repoRoot,
        "--dir", "/locus", "--bind", workspace, "/locus/workspace",
        "--bind", path.dirname(runtimeHome), "/locus/runtime",
        "--chdir", "/locus/workspace",
        "--setenv", "HOME", "/locus/runtime/home",
        "--setenv", "TMPDIR", "/locus/runtime/tmp",
        invocation.executable,
        ...invocation.args,
      ],
      cwd: workspace,
      workspaceView: "/locus/workspace",
      runtimeHomeView: "/locus/runtime/home",
    };
  }
  throw new Error(`Guard has no fail-closed containment backend for ${process.platform}.`);
}

function captureProcess(executable, args, { cwd, env }) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const child = spawn(executable, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.on("error", reject);
    child.on("close", (exitCode, signal) => resolve({
      exitCode: exitCode ?? 1,
      signal,
      durationMs: Date.now() - started,
      stdout: Buffer.concat(stdout),
      stderr: Buffer.concat(stderr),
    }));
  });
}

function boundedOutput(buffer) {
  const text = buffer.toString("utf8");
  if (Buffer.byteLength(text) <= MAX_EVIDENCE_OUTPUT_BYTES) {
    return { text, truncated: false };
  }
  return {
    text: Buffer.from(text).subarray(-MAX_EVIDENCE_OUTPUT_BYTES).toString("utf8"),
    truncated: true,
  };
}

function processEvidence(result) {
  const stdout = boundedOutput(result.stdout);
  const stderr = boundedOutput(result.stderr);
  return {
    exitCode: result.exitCode,
    signal: result.signal,
    durationMs: result.durationMs,
    stdout: {
      byteLength: result.stdout.byteLength,
      digest: sha256(result.stdout),
      relevantOutput: stdout.text,
      truncated: stdout.truncated,
    },
    stderr: {
      byteLength: result.stderr.byteLength,
      digest: sha256(result.stderr),
      relevantOutput: stderr.text,
      truncated: stderr.truncated,
    },
  };
}

function numericValue(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

export function parseProviderUsage(buffer) {
  const candidates = [];
  const text = buffer.toString("utf8").trim();
  for (const line of text.split(/\r?\n/).filter(Boolean)) {
    try {
      candidates.push(JSON.parse(line));
    } catch {
      // Provider output may mix human text and structured events.
    }
  }
  if (candidates.length === 0 && text) {
    try {
      candidates.push(JSON.parse(text));
    } catch {
      // No provider-reported usage is available.
    }
  }
  const found = {
    inputTokens: null,
    outputTokens: null,
    cachedInputTokens: null,
    costUsd: null,
  };
  const aliases = new Map([
    ["inputtokens", "inputTokens"],
    ["input_tokens", "inputTokens"],
    ["outputtokens", "outputTokens"],
    ["output_tokens", "outputTokens"],
    ["cachedinputtokens", "cachedInputTokens"],
    ["cached_input_tokens", "cachedInputTokens"],
    ["cache_read_input_tokens", "cachedInputTokens"],
    ["totalcostusd", "costUsd"],
    ["total_cost_usd", "costUsd"],
    ["costusd", "costUsd"],
    ["cost_usd", "costUsd"],
  ]);
  function visit(value) {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      const field = aliases.get(key.toLowerCase());
      const number = numericValue(child);
      if (field && number !== null) found[field] = Math.max(found[field] ?? 0, number);
      visit(child);
    }
  }
  for (const candidate of candidates) visit(candidate);
  const available = Object.values(found).some((value) => value !== null);
  return { status: available ? "provider-reported" : "unavailable", ...found };
}

function applyCandidate({ repoRoot, candidate }) {
  for (const record of candidate.records) {
    const target = originalPath(repoRoot, record.path);
    if (record.state === "deleted") {
      fs.unlinkSync(target);
      continue;
    }
    const after = candidate.current.get(record.path);
    writeFileSafely(target, after.contents, { allowedRoot: repoRoot, mode: after.executable ? 0o755 : 0o644 });
  }
}

async function executeChecks(repoRoot, commands) {
  const results = [];
  for (const command of commands) {
    const shell = process.platform === "win32" ? "cmd.exe" : "/bin/sh";
    const args = process.platform === "win32" ? ["/d", "/s", "/c", command] : ["-c", command];
    const result = await captureProcess(shell, args, {
      cwd: repoRoot,
      env: { ...process.env },
    });
    results.push({
      command,
      result: result.exitCode === 0 ? "pass" : "fail",
      ...processEvidence(result),
    });
  }
  return results;
}

function cleanAgentEnvironment({ runtimeHomeView, agent }) {
  const environment = { ...process.env };
  delete environment.OLDPWD;
  delete environment.INIT_CWD;
  environment.HOME = runtimeHomeView;
  environment.TMPDIR = path.posix.join(path.dirname(runtimeHomeView), "tmp");
  environment.LOCUS_GUARD = "1";
  if (agent === "codex") environment.CODEX_HOME = path.posix.join(runtimeHomeView, ".codex");
  return environment;
}

export async function runGuardedAgent({
  manifest,
  repoDir,
  expectedManifestHash,
  agent,
  prompt = "",
  model = null,
  commandArgv = [],
  checks = [],
  startedAt = new Date().toISOString(),
}) {
  verifyScopeManifest(manifest);
  if (!expectedManifestHash) {
    throw new Error("Guard Run requires a trusted expected manifest hash.");
  }
  if (manifest.manifestHash !== expectedManifestHash) {
    throw new Error(
      `Guard scope manifest does not match the trusted hash: expected ${expectedManifestHash}, got ${manifest.manifestHash}.`,
    );
  }
  const repoRoot = fs.realpathSync(path.resolve(repoDir));
  if (readGitIdentity(repoRoot) !== manifest.repository.identity) {
    throw new Error("Guard Run repository identity does not match the scope manifest.");
  }
  if (readGitHead(repoRoot) !== manifest.repository.baseSha) {
    throw new Error("Guard Run must start from the manifest's frozen base commit.");
  }
  assertCleanGitCheckout(repoRoot, [".locus/scope.json", ".locus/run-receipt.json"]);

  const ephemeralRoot = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "locus-guard-run-")),
  );
  const workspace = path.join(ephemeralRoot, "workspace");
  const runtimeHome = path.join(ephemeralRoot, "runtime", "home");
  fs.mkdirSync(workspace, { recursive: true });
  fs.mkdirSync(path.join(ephemeralRoot, "runtime", "tmp"), { recursive: true });
  fs.mkdirSync(runtimeHome, { recursive: true });
  try {
    const baseline = materializeSlice({
      repoRoot,
      workspace,
      admittedPaths: manifest.scope.admittedPaths,
    });
    copyProviderCredentials(agent, runtimeHome);
    const preliminary = sandboxInvocation({
      repoRoot,
      ephemeralRoot,
      workspace,
      runtimeHome,
      invocation: { executable: "/usr/bin/true", args: [] },
    });
    const invocation = agentInvocation({
      agent,
      prompt,
      model,
      commandArgv,
      workspaceView: preliminary.workspaceView,
    });
    const sandbox = sandboxInvocation({
      repoRoot,
      ephemeralRoot,
      workspace,
      runtimeHome,
      invocation,
    });
    const agentResult = await captureProcess(sandbox.executable, sandbox.args, {
      cwd: sandbox.cwd,
      env: cleanAgentEnvironment({
        runtimeHomeView: sandbox.runtimeHomeView,
        agent,
      }),
    });
    const candidate = inspectWorkspaceCandidate({
      workspace,
      baseline,
      admittedPaths: manifest.scope.admittedPaths,
    });
    const violations = [...candidate.violations];
    if (agentResult.exitCode !== 0) {
      violations.push({
        code: "AGENT_EXIT_NONZERO",
        path: null,
        message: `The contained agent exited with status ${agentResult.exitCode}.`,
      });
    }

    let checkResults = [];
    if (violations.length === 0) {
      assertCleanGitCheckout(repoRoot, [".locus/scope.json", ".locus/run-receipt.json"]);
      if (readGitHead(repoRoot) !== manifest.repository.baseSha) {
        throw new Error("Repo HEAD changed while the contained agent was running.");
      }
      applyCandidate({ repoRoot, candidate });
      checkResults = await executeChecks(repoRoot, checks);
      for (const check of checkResults.filter((item) => item.result === "fail")) {
        violations.push({
          code: "CHECK_FAILED",
          path: null,
          message: `Check failed with status ${check.exitCode}: ${check.command}`,
        });
      }
    }

    const enforcementResult = violations.length === 0 ? "pass" : "fail";
    const agentEvidence = processEvidence(agentResult);
    const body = {
      schemaVersion: GUARD_RUN_RECEIPT_SCHEMA,
      runner: { name: "locus-guard", version: GUARD_VERSION },
      enforcement: { mode: "contained-agent-run", result: enforcementResult },
      task: manifest.task,
      repository: {
        identity: manifest.repository.identity,
        baseSha: manifest.repository.baseSha,
        candidateKind: "working-tree-content",
      },
      manifest: {
        hash: manifest.manifestHash,
        trust: "expected-hash",
        policyVersion: manifest.policy.version,
        admittedPaths: manifest.scope.admittedPaths,
        widenEventHashes: manifest.widens.map((event) => event.eventHash),
      },
      containment: {
        backend: sandbox.backend,
        status: "enforced",
        targetRepo: "inaccessible",
        hostWrites: "ephemeral-only",
        network: "host-network",
        boundary: "target-repo",
      },
      execution: {
        agent,
        model,
        agentVersion: invocation.version,
        startedAt,
        durationMs: agentResult.durationMs,
        prompt: {
          digest: sha256(prompt),
          byteLength: Buffer.byteLength(prompt),
        },
        argv: {
          digest: sha256(canonicalJson([invocation.executable, ...invocation.args])),
          count: invocation.args.length + 1,
        },
        result: agentResult.exitCode === 0 ? "pass" : "fail",
        evidence: agentEvidence,
      },
      candidate: {
        hashAlgorithm: candidate.hashAlgorithm,
        hash: candidate.hash,
        changedPaths: candidate.changedPaths,
        records: candidate.records,
      },
      checks: checkResults,
      usage: {
        provider: agent === "command" ? "custom" : agent === "codex" ? "openai" : "anthropic",
        model,
        ...parseProviderUsage(agentResult.stdout),
      },
      review: { status: "pending" },
      violations,
    };
    return { ...body, receiptHash: sha256(canonicalJson(body)) };
  } finally {
    fs.rmSync(ephemeralRoot, { recursive: true, force: true });
  }
}

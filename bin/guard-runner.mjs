import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  GUARD_VERSION,
  assertCleanGitCheckout,
  canonicalJson,
  normalizeRepoPath,
  readGitHead,
  readGitIdentity,
  readJsonFile,
  sha256,
  verifyScopeManifest,
  writeFileSafely,
} from "./guard.mjs";

export const GUARD_RUN_RECEIPT_SCHEMA = "locus.guard.run-receipt.v1";
const MAX_EVIDENCE_OUTPUT_BYTES = 8_000;
const MAX_CAPTURE_OUTPUT_BYTES = 16 * 1024 * 1024;
const MAX_CANDIDATE_FILE_BYTES = 16 * 1024 * 1024;
const MAX_WORKSPACE_ENTRIES = 10_000;
const MAX_WORKSPACE_DEPTH = 64;
const MAX_WORKSPACE_APPARENT_BYTES = 256 * 1024 * 1024;
const AGENT_TIMEOUT_MS = 15 * 60 * 1000;
const CHECK_TIMEOUT_MS = 10 * 60 * 1000;
const CONTROL_ARTIFACT_PATHS = new Set([
  ".locus/scope.json",
  ".locus/run-receipt.json",
  ".locus/run.lock",
]);
const SNAPSHOT_HELPER = path.join(path.dirname(fileURLToPath(import.meta.url)), "guard-snapshot.mjs");

function guardTemporaryDirectory(prefix) {
  const base = process.platform === "darwin" ? "/private/tmp" : os.tmpdir();
  return fs.realpathSync(fs.mkdtempSync(path.join(base, prefix)));
}

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

function readRegularFileNoFollow(filePath, label) {
  const descriptor = fs.openSync(filePath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const before = fs.fstatSync(descriptor);
    if (!before.isFile()) throw new Error(`${label} must be a regular file: ${filePath}`);
    if (before.size > MAX_CANDIDATE_FILE_BYTES) {
      throw new Error(`${label} exceeds ${MAX_CANDIDATE_FILE_BYTES} bytes: ${filePath}`);
    }
    const contents = fs.readFileSync(descriptor);
    const after = fs.fstatSync(descriptor);
    if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size
      || before.mtimeMs !== after.mtimeMs) {
      throw new Error(`${label} changed while Guard was inspecting it: ${filePath}`);
    }
    return { stat: after, contents };
  } finally {
    fs.closeSync(descriptor);
  }
}

function originalPath(repoRoot, repoPath) {
  const target = path.resolve(repoRoot, normalizeRepoPath(repoPath));
  if (!isInside(repoRoot, target)) throw new Error(`Guard path escapes the Repo: ${repoPath}`);
  return target;
}

function canonicalRepoFile(repoRoot, filePath, label) {
  const canonical = fs.realpathSync(filePath);
  if (!isInside(repoRoot, canonical) || canonical !== path.resolve(filePath)) {
    throw new Error(`${label} contains a symlink or resolves outside the Repo: ${filePath}`);
  }
  return canonical;
}

function hashRegularFileNoFollow(filePath, label) {
  const descriptor = fs.openSync(filePath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const before = fs.fstatSync(descriptor);
    if (!before.isFile() || before.size > MAX_WORKSPACE_APPARENT_BYTES) {
      throw new Error(`${label} is not a bounded regular file: ${filePath}`);
    }
    const digest = createHash("sha256");
    const chunk = Buffer.allocUnsafe(64 * 1024);
    let byteLength = 0;
    while (byteLength < before.size) {
      const count = fs.readSync(
        descriptor,
        chunk,
        0,
        Math.min(chunk.byteLength, before.size - byteLength),
        null,
      );
      if (count === 0) break;
      digest.update(chunk.subarray(0, count));
      byteLength += count;
    }
    const after = fs.fstatSync(descriptor);
    if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size
      || before.mtimeMs !== after.mtimeMs || byteLength !== before.size) {
      throw new Error(`${label} changed while Guard was hashing it: ${filePath}`);
    }
    return { byteLength, contentHash: digest.digest("hex") };
  } finally {
    fs.closeSync(descriptor);
  }
}

function fileType(stat) {
  if (stat.isSymbolicLink()) return "symbolic-link";
  if (stat.isDirectory()) return "directory";
  if (stat.isFIFO()) return "fifo";
  if (stat.isSocket()) return "socket";
  if (stat.isCharacterDevice()) return "character-device";
  if (stat.isBlockDevice()) return "block-device";
  return "unknown";
}

function unsafeCandidateRecord(entry, state) {
  if (entry.stat.isSymbolicLink()) {
    const target = Buffer.from(fs.readlinkSync(entry.absolute));
    return {
      path: entry.repoPath,
      state,
      fileType: "symbolic-link",
      byteLength: target.byteLength,
      contentHash: sha256(target),
    };
  }
  if (entry.stat.isFile()) {
    return {
      path: entry.repoPath,
      state,
      fileType: "regular",
      ...hashRegularFileNoFollow(entry.absolute, "Oversized candidate path"),
      executable: Boolean(entry.stat.mode & 0o111),
    };
  }
  const metadata = {
    fileType: fileType(entry.stat),
    mode: entry.stat.mode,
    size: entry.stat.size,
    rdev: entry.stat.rdev,
  };
  return {
    path: entry.repoPath,
    state,
    ...metadata,
    byteLength: 0,
    contentHash: sha256(canonicalJson(metadata)),
  };
}

function materializeSlice({ repoRoot, workspace, admittedPaths }) {
  const baseline = new Map();
  for (const repoPath of admittedPaths) {
    const source = originalPath(repoRoot, repoPath);
    canonicalRepoFile(repoRoot, source, "Admitted Slice path");
    inspectRegularFile(source, "Admitted Slice path");
    const { stat, contents } = readRegularFileNoFollow(source, "Admitted Slice path");
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

function assertRepoMatchesBaseline({ repoRoot, baseline }) {
  for (const [repoPath, expected] of baseline) {
    const source = originalPath(repoRoot, repoPath);
    canonicalRepoFile(repoRoot, source, "Frozen base path");
    const { stat, contents } = readRegularFileNoFollow(source, "Frozen base path");
    if (!contents.equals(expected.contents)
      || Boolean(stat.mode & 0o111) !== expected.executable) {
      throw new Error(`Repo path changed since the frozen base was read: ${repoPath}`);
    }
  }
}

function walkWorkspace(
  directory,
  prefix = "",
  state = { entries: 0, bytes: 0 },
  depth = 0,
) {
  if (depth > MAX_WORKSPACE_DEPTH) {
    throw new Error(`Candidate workspace exceeds ${MAX_WORKSPACE_DEPTH} directory levels.`);
  }
  const entries = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const repoPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = path.join(directory, entry.name);
    const stat = fs.lstatSync(absolute);
    state.entries += 1;
    if (state.entries > MAX_WORKSPACE_ENTRIES) {
      throw new Error(`Candidate workspace exceeds ${MAX_WORKSPACE_ENTRIES} entries.`);
    }
    if (stat.isFile()) {
      state.bytes += stat.size;
      if (state.bytes > MAX_WORKSPACE_APPARENT_BYTES) {
        throw new Error(
          `Candidate workspace exceeds ${MAX_WORKSPACE_APPARENT_BYTES} apparent bytes.`,
        );
      }
    }
    entries.push({ repoPath: normalizeRepoPath(repoPath), absolute, stat });
    if (stat.isDirectory()) {
      entries.push(...walkWorkspace(absolute, repoPath, state, depth + 1));
    }
  }
  return entries;
}

function inspectWorkspaceCandidate({ workspace, baseline, admittedPaths }) {
  const admitted = new Set(admittedPaths);
  const violations = [];
  const current = new Map();
  const outsideRecords = [];
  const unsafeAdmittedRecords = new Map();
  const admittedParentDirectories = new Set();
  for (const repoPath of admittedPaths) {
    let parent = path.posix.dirname(repoPath);
    while (parent !== ".") {
      admittedParentDirectories.add(parent);
      parent = path.posix.dirname(parent);
    }
  }
  for (const entry of walkWorkspace(workspace)) {
    if (entry.stat.isDirectory() && admittedParentDirectories.has(entry.repoPath)) continue;
    if (!admitted.has(entry.repoPath)) {
      violations.push({
        code: "PATH_OUTSIDE_SCOPE",
        path: entry.repoPath,
        message: `${entry.repoPath} was created outside the admitted Slice.`,
      });
      if (entry.stat.isFile() && !entry.stat.isSymbolicLink()
        && entry.stat.size <= MAX_CANDIDATE_FILE_BYTES) {
        const { contents } = readRegularFileNoFollow(entry.absolute, "Candidate path");
        outsideRecords.push({
          path: entry.repoPath,
          state: "created-outside-scope",
          byteLength: contents.byteLength,
          contentHash: sha256(contents),
          executable: Boolean(entry.stat.mode & 0o111),
        });
      } else {
        outsideRecords.push(unsafeCandidateRecord(entry, "unsafe-outside-scope"));
      }
      continue;
    }
    if (entry.stat.isSymbolicLink() || !entry.stat.isFile()) {
      violations.push({
        code: "UNSAFE_FILE_TYPE",
        path: entry.repoPath,
        message: `${entry.repoPath} is not a regular file.`,
      });
      unsafeAdmittedRecords.set(
        entry.repoPath,
        unsafeCandidateRecord(entry, "unsafe-admitted-path"),
      );
      continue;
    }
    if (entry.stat.size > MAX_CANDIDATE_FILE_BYTES) {
      violations.push({
        code: "FILE_TOO_LARGE",
        path: entry.repoPath,
        message: `${entry.repoPath} exceeds ${MAX_CANDIDATE_FILE_BYTES} bytes.`,
      });
      unsafeAdmittedRecords.set(
        entry.repoPath,
        unsafeCandidateRecord(entry, "oversized-admitted-path"),
      );
      continue;
    }
    const inspected = readRegularFileNoFollow(entry.absolute, "Candidate path");
    current.set(entry.repoPath, {
      contents: inspected.contents,
      executable: Boolean(inspected.stat.mode & 0o111),
    });
  }

  const records = [...outsideRecords];
  for (const repoPath of [...admitted].sort()) {
    const before = baseline.get(repoPath);
    const after = current.get(repoPath);
    if (unsafeAdmittedRecords.has(repoPath)) {
      records.push(unsafeAdmittedRecords.get(repoPath));
      continue;
    }
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
  records.sort((left, right) => left.path.localeCompare(right.path));
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
    return { executable, args: commandArgv.slice(1) };
  }
  if (!prompt?.trim()) throw new Error(`The ${agent} adapter requires --prompt.`);
  const executable = findExecutable(agent);
  if (!executable) throw new Error(`${agent} is not installed or is not on PATH.`);
  if (agent === "codex") {
    return {
      executable,
      args: [
        "exec", "--json", "--sandbox", "workspace-write", "--skip-git-repo-check",
        "--cd", workspaceView,
        ...(model ? ["--model", model] : []),
        prompt,
      ],
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
    };
  }
  throw new Error(`Unsupported Guard agent adapter: ${agent}`);
}

function seatbeltProfile({ repoRoot, ephemeralRoot, protectedRoots }) {
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
    ...protectedRoots.map((protectedRoot) =>
      `(deny file-read* (subpath ${JSON.stringify(protectedRoot)}))`),
    ...protectedRoots.flatMap((protectedRoot) =>
      [protectedRoot, path.dirname(protectedRoot)].map((writeProtectedRoot) =>
        `(deny file-write* (subpath ${JSON.stringify(writeProtectedRoot)}))`)),
    `(allow file-write* (subpath ${runtime}))`,
    '(allow file-write* (literal "/dev/null") (literal "/dev/tty"))',
  ].join("\n");
}

function sandboxInvocation({
  repoRoot,
  ephemeralRoot,
  workspace,
  runtimeHome,
  invocation,
  protectedRoots,
}) {
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
        seatbeltProfile({ repoRoot, ephemeralRoot, protectedRoots }),
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
        "--unshare-ipc", "--share-net", "--ro-bind", "/", "/", "--proc", "/proc",
        "--tmpfs", repoRoot,
        ...protectedRoots.flatMap((protectedRoot) => ["--tmpfs", protectedRoot]),
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

function snapshotInvocation({ repoRoot, workspace, snapshotWorkspace, protectedRoots }) {
  const limitArgs = [
    String(MAX_WORKSPACE_ENTRIES),
    String(MAX_WORKSPACE_DEPTH),
    String(MAX_WORKSPACE_APPARENT_BYTES),
  ];
  if (process.platform === "darwin") {
    const sandboxExecutable = findExecutable("sandbox-exec");
    if (!sandboxExecutable) {
      throw new Error("Guard refused to snapshot because macOS Seatbelt is unavailable.");
    }
    const profile = [
      "(version 1)",
      "(deny default)",
      "(allow process*)",
      "(allow sysctl-read)",
      "(allow mach-lookup)",
      "(allow signal)",
      "(allow ipc-posix*)",
      "(allow file-read*)",
      `(deny file-read* (subpath ${JSON.stringify(repoRoot)}))`,
      ...protectedRoots.map((protectedRoot) =>
        `(deny file-read* (subpath ${JSON.stringify(protectedRoot)}))`),
      `(allow file-write* (subpath ${JSON.stringify(snapshotWorkspace)}))`,
      '(allow file-write* (literal "/dev/null"))',
    ].join("\n");
    return {
      executable: sandboxExecutable,
      args: [
        "-p", profile, process.execPath, SNAPSHOT_HELPER,
        workspace, snapshotWorkspace, ...limitArgs,
      ],
    };
  }
  if (process.platform === "linux") {
    const bubblewrap = findExecutable("bwrap");
    if (!bubblewrap) {
      throw new Error("Guard refused to snapshot because Linux Bubblewrap is unavailable.");
    }
    return {
      executable: bubblewrap,
      args: [
        "--die-with-parent", "--new-session", "--unshare-pid", "--unshare-uts", "--unshare-ipc",
        "--ro-bind", "/", "/", "--proc", "/proc", "--tmpfs", repoRoot,
        ...protectedRoots.flatMap((protectedRoot) => ["--tmpfs", protectedRoot]),
        "--ro-bind", workspace, "/locus-source",
        "--bind", snapshotWorkspace, "/locus-snapshot",
        process.execPath, SNAPSHOT_HELPER,
        "/locus-source", "/locus-snapshot", ...limitArgs,
      ],
    };
  }
  throw new Error(`Guard has no fail-closed snapshot backend for ${process.platform}.`);
}

async function captureCandidateSnapshot({
  repoRoot,
  workspace,
  snapshotWorkspace,
  protectedRoots,
}) {
  const invocation = snapshotInvocation({
    repoRoot,
    workspace,
    snapshotWorkspace,
    protectedRoots,
  });
  const result = await captureProcess(invocation.executable, invocation.args, {
    cwd: workspace,
    env: cleanCheckEnvironment(workspace),
    timeoutMs: CHECK_TIMEOUT_MS,
  });
  if (result.exitCode !== 0 || result.timedOut || result.outputLimitExceeded) {
    throw new Error("Guard could not create an immutable candidate snapshot.");
  }
}

function processGroupExists(pid) {
  try {
    process.kill(-pid, 0);
    return true;
  } catch (cause) {
    if (cause?.code === "ESRCH") return false;
    throw cause;
  }
}

async function terminateProcessGroup(pid) {
  if (process.platform === "win32") return;
  try {
    process.kill(-pid, "SIGKILL");
  } catch (cause) {
    if (cause?.code !== "ESRCH") throw cause;
  }
  for (let attempt = 0; attempt < 100 && processGroupExists(pid); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  if (processGroupExists(pid)) {
    throw new Error(`Guard could not terminate process group ${pid}.`);
  }
}

function captureProcess(executable, args, { cwd, env, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const child = spawn(executable, args, {
      cwd,
      env,
      detached: process.platform !== "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    const outputEvidence = {
      stdout: { byteLength: 0, digest: createHash("sha256") },
      stderr: { byteLength: 0, digest: createHash("sha256") },
    };
    let capturedBytes = 0;
    let timedOut = false;
    let outputLimitExceeded = false;
    function terminate(reason) {
      if (reason === "timeout") timedOut = true;
      if (reason === "output-limit") outputLimitExceeded = true;
      try {
        if (process.platform === "win32") child.kill("SIGKILL");
        else process.kill(-child.pid, "SIGKILL");
      } catch (cause) {
        if (cause?.code !== "ESRCH") reject(cause);
      }
    }
    function capture(stream, target, chunk) {
      outputEvidence[stream].byteLength += chunk.byteLength;
      outputEvidence[stream].digest.update(chunk);
      const remaining = Math.max(0, MAX_CAPTURE_OUTPUT_BYTES - capturedBytes);
      if (remaining > 0) target.push(Buffer.from(chunk).subarray(0, remaining));
      capturedBytes += chunk.byteLength;
      if (capturedBytes > MAX_CAPTURE_OUTPUT_BYTES && !outputLimitExceeded) {
        terminate("output-limit");
      }
    }
    child.stdout.on("data", (chunk) => capture("stdout", stdout, chunk));
    child.stderr.on("data", (chunk) => capture("stderr", stderr, chunk));
    child.on("error", reject);
    const timer = setTimeout(() => terminate("timeout"), timeoutMs);
    child.on("exit", async (exitCode, signal) => {
      clearTimeout(timer);
      try {
        await terminateProcessGroup(child.pid);
        await new Promise((resolveDrain) => setTimeout(resolveDrain, 25));
        child.stdout.destroy();
        child.stderr.destroy();
        resolve({
          exitCode: exitCode ?? 1,
          signal,
          durationMs: Date.now() - started,
          timedOut,
          outputLimitExceeded,
          stdout: Buffer.concat(stdout),
          stderr: Buffer.concat(stderr),
          stdoutByteLength: outputEvidence.stdout.byteLength,
          stderrByteLength: outputEvidence.stderr.byteLength,
          stdoutDigest: outputEvidence.stdout.digest.digest("hex"),
          stderrDigest: outputEvidence.stderr.digest.digest("hex"),
        });
      } catch (cause) {
        reject(cause);
      }
    });
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

function processEvidence(result, { redactions = [] } = {}) {
  function redact(buffer) {
    let value = buffer.toString("utf8");
    for (const redaction of redactions.filter(Boolean)) {
      value = value.replaceAll(redaction, "[REDACTED_PROMPT]");
    }
    return Buffer.from(value);
  }
  const stdout = boundedOutput(redact(result.stdout));
  const stderr = boundedOutput(redact(result.stderr));
  return {
    exitCode: result.exitCode,
    signal: result.signal,
    durationMs: result.durationMs,
    timedOut: result.timedOut,
    outputLimitExceeded: result.outputLimitExceeded,
    stdout: {
      byteLength: result.stdoutByteLength,
      digest: result.stdoutDigest,
      relevantOutput: stdout.text,
      truncated: stdout.truncated,
    },
    stderr: {
      byteLength: result.stderrByteLength,
      digest: result.stderrDigest,
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

function git(repoRoot, args, { encoding = "utf8" } = {}) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding,
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
}

function createCheckWorktree({ repoRoot, checkWorkspace, baseSha }) {
  git(repoRoot, ["worktree", "add", "--quiet", "--detach", checkWorkspace, baseSha]);
  const dependencies = path.join(repoRoot, "node_modules");
  const checkDependencies = path.join(checkWorkspace, "node_modules");
  if (fs.existsSync(dependencies) && !fs.existsSync(checkDependencies)) {
    fs.symlinkSync(dependencies, checkDependencies, "dir");
  }
}

function removeCheckWorktree(repoRoot, checkWorkspace) {
  git(repoRoot, ["worktree", "remove", "--force", checkWorkspace]);
}

function dirtyEntries(repoRoot) {
  const output = git(repoRoot, ["status", "--porcelain=v1", "-z", "--untracked-files=all"], {
    encoding: "buffer",
  });
  const records = output.toString("utf8").split("\0").filter(Boolean);
  const entries = [];
  for (let index = 0; index < records.length; index++) {
    const record = records[index];
    const status = record.slice(0, 2);
    entries.push({ status, path: normalizeRepoPath(record.slice(3)) });
    if (status.includes("R") || status.includes("C")) {
      entries.push({ status, path: normalizeRepoPath(records[++index]) });
    }
  }
  return entries;
}

function candidateDirtyEntries(repoRoot) {
  return dirtyEntries(repoRoot).filter(
    (entry) => entry.status !== "??" || !CONTROL_ARTIFACT_PATHS.has(entry.path),
  );
}

function inspectAppliedCandidate({ repoRoot, candidate }) {
  const violations = [];
  const actual = candidateDirtyEntries(repoRoot);
  const actualPaths = [...new Set(actual.map((entry) => entry.path))].sort();
  const expectedPaths = [...candidate.changedPaths].sort();
  if (canonicalJson(actualPaths) !== canonicalJson(expectedPaths)) {
    violations.push({
      code: "CHECK_MUTATED_CANDIDATE",
      path: null,
      message: "The Repo paths after Checks do not match the signed candidate.",
    });
    return violations;
  }
  if (actual.some((entry) => entry.status[0] !== " " && entry.status !== "??")) {
    violations.push({
      code: "CHECK_MUTATED_CANDIDATE",
      path: null,
      message: "A Check staged or otherwise rewrote candidate state.",
    });
    return violations;
  }
  for (const record of candidate.records) {
    const target = originalPath(repoRoot, record.path);
    if (record.state === "deleted") {
      if (fs.existsSync(target)) {
        violations.push({
          code: "CHECK_MUTATED_CANDIDATE",
          path: record.path,
          message: `${record.path} no longer matches the deleted candidate record.`,
        });
      }
      continue;
    }
    try {
      const { stat, contents } = readRegularFileNoFollow(target, "Applied candidate path");
      if (contents.byteLength !== record.byteLength || sha256(contents) !== record.contentHash
        || Boolean(stat.mode & 0o111) !== record.executable) {
        violations.push({
          code: "CHECK_MUTATED_CANDIDATE",
          path: record.path,
          message: `${record.path} no longer matches the signed candidate record.`,
        });
      }
    } catch {
      violations.push({
        code: "CHECK_MUTATED_CANDIDATE",
        path: record.path,
        message: `${record.path} is no longer a safe regular candidate file.`,
      });
    }
  }
  return violations;
}

export function rollbackGuardCandidate(repoRoot, candidatePaths) {
  const allowed = new Set(candidatePaths.map(normalizeRepoPath));
  const entries = candidateDirtyEntries(repoRoot).filter((entry) => allowed.has(entry.path));
  const tracked = [...new Set(
    entries.filter((entry) => entry.status !== "??").map((entry) => entry.path),
  )];
  if (tracked.length > 0) {
    git(repoRoot, ["restore", "--source=HEAD", "--staged", "--worktree", "--", ...tracked]);
  }
  for (const repoPath of [...new Set(
    entries.filter((entry) => entry.status === "??").map((entry) => entry.path),
  )]) {
    const target = originalPath(repoRoot, repoPath);
    fs.rmSync(target, { recursive: true, force: true });
  }
}

function resolveGitControlRoots(repoRoot) {
  return ["--git-dir", "--git-common-dir"].map((flag) => {
    const value = git(repoRoot, ["rev-parse", flag]).trim();
    return fs.realpathSync(path.resolve(repoRoot, value));
  });
}

function checkSandboxInvocation({ repoRoot, originalRepoRoot, command, protectedRoots }) {
  const shell = process.platform === "win32" ? "cmd.exe" : "/bin/sh";
  const shellArgs = process.platform === "win32" ? ["/d", "/s", "/c", command] : ["-c", command];
  if (process.platform === "darwin") {
    const sandboxExecutable = findExecutable("sandbox-exec");
    if (!sandboxExecutable) throw new Error("Guard refused Checks because macOS Seatbelt is unavailable.");
    const writeProtectedRoots = [
      originalRepoRoot,
      ...resolveGitControlRoots(repoRoot),
      ...protectedRoots.flatMap((protectedRoot) => [protectedRoot, path.dirname(protectedRoot)]),
    ];
    const profile = [
      "(version 1)",
      "(allow default)",
      ...writeProtectedRoots.map((protectedRoot) =>
        `(deny file-write* (subpath ${JSON.stringify(protectedRoot)}))`),
      ...protectedRoots.map((protectedRoot) =>
        `(deny file-read* (subpath ${JSON.stringify(protectedRoot)}))`),
    ].join("\n");
    return { executable: sandboxExecutable, args: ["-p", profile, shell, ...shellArgs] };
  }
  if (process.platform === "linux") {
    const bubblewrap = findExecutable("bwrap");
    if (!bubblewrap) throw new Error("Guard refused Checks because Linux Bubblewrap is unavailable.");
    const gitControlRoots = resolveGitControlRoots(repoRoot);
    return {
      executable: bubblewrap,
      args: [
        "--die-with-parent", "--new-session", "--unshare-pid", "--unshare-uts", "--unshare-ipc",
        "--share-net", "--ro-bind", "/", "/", "--proc", "/proc",
        "--bind", repoRoot, repoRoot,
        ...gitControlRoots.flatMap((gitRoot) => ["--ro-bind", gitRoot, gitRoot]),
        ...protectedRoots.flatMap((protectedRoot) => ["--tmpfs", protectedRoot]),
        "--dir", "/locus-tmp", "--chdir", repoRoot, shell, ...shellArgs,
      ],
    };
  }
  throw new Error(`Guard has no fail-closed Check backend for ${process.platform}.`);
}

function cleanCheckEnvironment(repoRoot) {
  const environment = { ...process.env };
  for (const key of Object.keys(environment)) {
    if (key.startsWith("LOCUS_GUARD_SIGN") || key.includes("PRIVATE_KEY")) delete environment[key];
  }
  environment.TMPDIR = process.platform === "linux" ? "/locus-tmp" : "/private/tmp";
  environment.PWD = repoRoot;
  return environment;
}

async function executeChecks(repoRoot, commands, { originalRepoRoot, protectedRoots }) {
  const results = [];
  for (const command of commands) {
    const sandbox = checkSandboxInvocation({
      repoRoot,
      originalRepoRoot,
      command,
      protectedRoots,
    });
    const result = await captureProcess(sandbox.executable, sandbox.args, {
      cwd: repoRoot,
      env: cleanCheckEnvironment(repoRoot),
      timeoutMs: CHECK_TIMEOUT_MS,
    });
    results.push({
      command,
      result: result.exitCode === 0 && !result.timedOut && !result.outputLimitExceeded
        ? "pass"
        : "fail",
      ...processEvidence(result),
    });
  }
  return results;
}

function cleanAgentEnvironment({ runtimeHomeView, agent }) {
  const common = [
    "PATH", "LANG", "LC_ALL", "LC_CTYPE", "TERM", "COLORTERM",
    "SSL_CERT_FILE", "SSL_CERT_DIR", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "NO_PROXY",
  ];
  const provider = agent === "codex"
    ? ["OPENAI_API_KEY", "OPENAI_BASE_URL", "OPENAI_ORG_ID", "OPENAI_PROJECT_ID"]
    : agent === "claude"
      ? Object.keys(process.env).filter((key) =>
        key.startsWith("ANTHROPIC_")
        || key.startsWith("CLAUDE_CODE_USE_")
        || key.startsWith("AWS_")
        || key.startsWith("AZURE_")
        || key === "GOOGLE_APPLICATION_CREDENTIALS")
      : [];
  const environment = {};
  for (const key of [...common, ...provider]) {
    if (process.env[key] !== undefined) environment[key] = process.env[key];
  }
  environment.HOME = runtimeHomeView;
  environment.TMPDIR = path.posix.join(path.dirname(runtimeHomeView), "tmp");
  environment.LOCUS_GUARD = "1";
  if (agent === "codex") environment.CODEX_HOME = path.posix.join(runtimeHomeView, ".codex");
  return environment;
}

export async function runGuardedAgent({
  manifest,
  manifestPath,
  repoDir,
  expectedManifestHash,
  protectedRoots = [],
  agent,
  prompt = "",
  model = null,
  commandArgv = [],
  checks = [],
  startedAt = new Date().toISOString(),
}) {
  verifyScopeManifest(manifest);
  if (!manifestPath) throw new Error("Guard Run requires the scope manifest path.");
  if (!Array.isArray(checks) || checks.length === 0) {
    throw new Error("Guard Run requires at least one Check.");
  }
  if (!expectedManifestHash) {
    throw new Error("Guard Run requires a trusted expected manifest hash.");
  }
  if (manifest.manifestHash !== expectedManifestHash) {
    throw new Error(
      `Guard scope manifest does not match the trusted hash: expected ${expectedManifestHash}, got ${manifest.manifestHash}.`,
    );
  }
  const repoRoot = fs.realpathSync(path.resolve(repoDir));
  const protectedCanonicalRoots = protectedRoots.map((protectedRoot) =>
    fs.realpathSync(path.resolve(protectedRoot)));
  if (readGitIdentity(repoRoot) !== manifest.repository.identity) {
    throw new Error("Guard Run repository identity does not match the scope manifest.");
  }
  if (readGitHead(repoRoot) !== manifest.repository.baseSha) {
    throw new Error("Guard Run must start from the manifest's frozen base commit.");
  }
  assertCleanGitCheckout(repoRoot, [...CONTROL_ARTIFACT_PATHS]);

  const ephemeralRoot = guardTemporaryDirectory("locus-guard-run-");
  const snapshotRoot = guardTemporaryDirectory("locus-guard-snapshot-");
  const workspace = path.join(ephemeralRoot, "workspace");
  const snapshotWorkspace = path.join(snapshotRoot, "workspace");
  const checkWorkspace = path.join(ephemeralRoot, "check-worktree");
  const runtimeHome = path.join(ephemeralRoot, "runtime", "home");
  fs.mkdirSync(workspace, { recursive: true });
  fs.mkdirSync(snapshotWorkspace, { recursive: true });
  fs.mkdirSync(path.join(ephemeralRoot, "runtime", "tmp"), { recursive: true });
  fs.mkdirSync(runtimeHome, { recursive: true });
  let candidateApplied = false;
  let checkWorktreeAdded = false;
  let candidate = null;
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
      protectedRoots: protectedCanonicalRoots,
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
      protectedRoots: protectedCanonicalRoots,
    });
    const agentResult = await captureProcess(sandbox.executable, sandbox.args, {
      cwd: sandbox.cwd,
      env: cleanAgentEnvironment({
        runtimeHomeView: sandbox.runtimeHomeView,
        agent,
      }),
      timeoutMs: AGENT_TIMEOUT_MS,
    });
    await captureCandidateSnapshot({
      repoRoot,
      workspace,
      snapshotWorkspace,
      protectedRoots: protectedCanonicalRoots,
    });
    candidate = inspectWorkspaceCandidate({
      workspace: snapshotWorkspace,
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
    if (agentResult.timedOut) {
      violations.push({
        code: "AGENT_TIMEOUT",
        path: null,
        message: `The contained agent exceeded ${AGENT_TIMEOUT_MS} ms.`,
      });
    }
    if (agentResult.outputLimitExceeded) {
      violations.push({
        code: "AGENT_OUTPUT_LIMIT",
        path: null,
        message: `The contained agent exceeded ${MAX_CAPTURE_OUTPUT_BYTES} output bytes.`,
      });
    }

    let checkResults = [];
    if (violations.length === 0) {
      createCheckWorktree({
        repoRoot,
        checkWorkspace,
        baseSha: manifest.repository.baseSha,
      });
      checkWorktreeAdded = true;
      applyCandidate({ repoRoot: checkWorkspace, candidate });
      violations.push(...inspectAppliedCandidate({ repoRoot: checkWorkspace, candidate }));
      if (violations.length === 0) {
        checkResults = await executeChecks(checkWorkspace, checks, {
          originalRepoRoot: repoRoot,
          protectedRoots: protectedCanonicalRoots,
        });
        violations.push(...inspectAppliedCandidate({ repoRoot: checkWorkspace, candidate }));
      }
      for (const check of checkResults.filter((item) => item.result === "fail")) {
        violations.push({
          code: "CHECK_FAILED",
          path: null,
          message: `Check failed with status ${check.exitCode}: ${check.command}`,
        });
      }
      removeCheckWorktree(repoRoot, checkWorkspace);
      checkWorktreeAdded = false;
    }

    if (violations.length === 0) {
      const currentManifest = readJsonFile(path.resolve(manifestPath), "Guard scope manifest");
      verifyScopeManifest(currentManifest);
      if (currentManifest.manifestHash !== expectedManifestHash
        || canonicalJson(currentManifest) !== canonicalJson(manifest)) {
        throw new Error("Guard scope manifest changed while the contained agent was running.");
      }
      if (readGitIdentity(repoRoot) !== currentManifest.repository.identity) {
        throw new Error("Guard Run repository identity changed while the contained agent was running.");
      }
      assertCleanGitCheckout(repoRoot, [...CONTROL_ARTIFACT_PATHS]);
      if (readGitHead(repoRoot) !== currentManifest.repository.baseSha) {
        throw new Error("Repo HEAD changed while the contained agent was running.");
      }
      assertRepoMatchesBaseline({ repoRoot, baseline });
      candidateApplied = true;
      applyCandidate({ repoRoot, candidate });
      violations.push(...inspectAppliedCandidate({ repoRoot, candidate }));
      if (violations.length > 0) {
        rollbackGuardCandidate(repoRoot, candidate.changedPaths);
        candidateApplied = false;
      }
    }

    const enforcementResult = violations.length === 0 ? "pass" : "fail";
    const agentEvidence = processEvidence(agentResult, { redactions: [prompt] });
    const body = {
      schemaVersion: GUARD_RUN_RECEIPT_SCHEMA,
      runner: { name: "locus-guard", version: GUARD_VERSION },
      enforcement: { mode: "contained-agent-run", result: enforcementResult },
      task: {
        id: manifest.task.id,
        description: {
          digest: sha256(manifest.task.description),
          byteLength: Buffer.byteLength(manifest.task.description),
        },
        evidence: manifest.task.evidence,
      },
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
  } catch (cause) {
    if (candidateApplied && candidate) rollbackGuardCandidate(repoRoot, candidate.changedPaths);
    throw cause;
  } finally {
    if (checkWorktreeAdded) {
      try {
        removeCheckWorktree(repoRoot, checkWorkspace);
      } catch {
        git(repoRoot, ["worktree", "prune"]);
      }
    }
    fs.rmSync(ephemeralRoot, { recursive: true, force: true });
    fs.rmSync(snapshotRoot, { recursive: true, force: true });
  }
}

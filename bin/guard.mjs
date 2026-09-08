import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export const GUARD_SCOPE_SCHEMA = "locus.guard.scope.v1";
export const GUARD_RECEIPT_SCHEMA = "locus.guard.receipt.v1";
export const GUARD_VERSION = "0.4.0";

export const DEFAULT_SENSITIVE_PATTERNS = Object.freeze([
  ".env",
  ".env.*",
  ".git/**",
  ".github/workflows/**",
  "**/*.key",
  "**/*.pem",
]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalValue(value[key])]),
  );
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalValue(value));
}

export function sha256(value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function hashObject(value) {
  return sha256(canonicalJson(value));
}

export function normalizeRepoPath(input) {
  if (typeof input !== "string" || !input.trim()) {
    throw new Error("Guard paths must be non-empty strings.");
  }
  if (input.includes("\0")) throw new Error("Guard paths cannot contain NUL bytes.");
  const slashPath = input.replaceAll("\\", "/");
  if (path.posix.isAbsolute(slashPath)) {
    throw new Error(`Guard paths must be Repo-relative: ${input}`);
  }
  const normalized = path.posix.normalize(slashPath).replace(/^\.\//, "");
  if (normalized === "." || normalized === ".." || normalized.startsWith("../")) {
    throw new Error(`Guard path escapes the Repo: ${input}`);
  }
  return normalized;
}

function uniqueSortedPaths(paths, label) {
  if (!Array.isArray(paths)) throw new Error(`${label} must be an array.`);
  return [...new Set(paths.map(normalizeRepoPath))].sort();
}

function normalizeInclusionReasons(admittedPaths, inclusionReasons = null) {
  const entries = inclusionReasons ?? admittedPaths.map((repoPath) => ({
    path: repoPath,
    reasons: ["explicit admission"],
  }));
  if (!Array.isArray(entries)) throw new Error("inclusionReasons must be an array.");
  const normalized = entries.map((entry, index) => {
    if (!isPlainObject(entry)) throw new Error(`inclusionReasons[${index}] must be an object.`);
    const repoPath = normalizeRepoPath(entry.path);
    if (!Array.isArray(entry.reasons) || entry.reasons.length === 0) {
      throw new Error(`inclusionReasons[${index}].reasons must be a non-empty array.`);
    }
    return {
      path: repoPath,
      reasons: [...new Set(entry.reasons.map((reason) =>
        requireString(reason, `inclusionReasons[${index}].reasons`)))].sort(),
    };
  }).sort((left, right) => left.path.localeCompare(right.path));
  const reasonPaths = normalized.map((entry) => entry.path);
  if (new Set(reasonPaths).size !== reasonPaths.length) {
    throw new Error("Each admitted path must have exactly one inclusionReasons entry.");
  }
  if (canonicalJson(reasonPaths) !== canonicalJson([...admittedPaths].sort())) {
    throw new Error("inclusionReasons must describe every admitted path and no other path.");
  }
  return normalized;
}

function normalizeEvidence(evidence, label) {
  if (!Array.isArray(evidence)) throw new Error(`${label} must be an array.`);
  return evidence.map((item, index) => {
    if (!isPlainObject(item)) throw new Error(`${label}[${index}] must be an object.`);
    const digest = requireString(item.digest, `${label}[${index}].digest`).toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(digest)) {
      throw new Error(`${label}[${index}].digest must be a SHA-256 hex digest.`);
    }
    if (!Number.isSafeInteger(item.byteLength) || item.byteLength < 0) {
      throw new Error(`${label}[${index}].byteLength must be a non-negative integer.`);
    }
    return {
      kind: requireString(item.kind, `${label}[${index}].kind`),
      digest,
      byteLength: item.byteLength,
    };
  });
}

function requireString(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

function requireCommitOid(value, label) {
  const oid = requireString(value, label).toLowerCase();
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(oid)) {
    throw new Error(`${label} must be a full 40- or 64-character Git commit OID.`);
  }
  return oid;
}

function globToRegExp(pattern) {
  const normalized = normalizeRepoPath(pattern);
  let source = "";
  for (let index = 0; index < normalized.length; index++) {
    const char = normalized[index];
    if (char === "*" && normalized[index + 1] === "*" && normalized[index + 2] === "/") {
      source += "(?:.*/)?";
      index += 2;
    } else if (char === "*" && normalized[index + 1] === "*") {
      source += ".*";
      index += 1;
    } else if (char === "*") {
      source += "[^/]*";
    } else {
      source += char.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
    }
  }
  return new RegExp(`^${source}$`);
}

export function matchesSensitivePath(repoPath, patterns = DEFAULT_SENSITIVE_PATTERNS) {
  const normalized = normalizeRepoPath(repoPath);
  return patterns.some((pattern) => globToRegExp(pattern).test(normalized));
}

export function normalizeRepositoryIdentity(value) {
  const identity = requireString(value, "repository");
  const ssh = /^git@([^:]+):(.+?)(?:\.git)?$/.exec(identity);
  if (ssh) return `${ssh[1].toLowerCase()}/${ssh[2].replace(/\.git$/, "")}`;
  try {
    const url = new URL(identity);
    if (["http:", "https:", "ssh:"].includes(url.protocol)) {
      return `${url.hostname.toLowerCase()}${url.pathname.replace(/\.git$/, "").replace(/\/$/, "")}`;
    }
  } catch {
    // Local checkouts deliberately use their absolute path as the identity.
  }
  return path.resolve(identity);
}

function manifestBody(manifest) {
  return Object.fromEntries(
    Object.entries(manifest).filter(([key]) => key !== "manifestHash"),
  );
}

function widenEventBody(event) {
  return Object.fromEntries(
    Object.entries(event).filter(([key]) => key !== "eventHash"),
  );
}

function currentScope(initialScope, widens) {
  const admitted = new Set(initialScope.admittedPaths);
  const excluded = new Set(initialScope.excludedPaths);
  const inclusionReasons = new Map(
    initialScope.inclusionReasons.map((entry) => [entry.path, entry]),
  );
  for (const event of widens) {
    if (event.decision !== "approved") continue;
    admitted.add(event.path);
    excluded.delete(event.path);
    inclusionReasons.set(event.path, {
      path: event.path,
      reasons: [`approved Widen ${event.eventHash}`],
    });
  }
  return {
    admittedPaths: [...admitted].sort(),
    excludedPaths: [...excluded].sort(),
    inclusionReasons: [...inclusionReasons.values()].sort((left, right) =>
      left.path.localeCompare(right.path)),
  };
}

export function createScopeManifest({
  task,
  taskId = null,
  repository,
  baseSha,
  admittedPaths,
  excludedPaths = [],
  sensitivePatterns = DEFAULT_SENSITIVE_PATTERNS,
  taskEvidence = [],
  inclusionReasons = null,
  policyVersion = "1",
  actor = "local-user",
  createdAt = new Date().toISOString(),
}) {
  const initialScope = {
    admittedPaths: uniqueSortedPaths(admittedPaths, "admittedPaths"),
    excludedPaths: uniqueSortedPaths(excludedPaths, "excludedPaths"),
    inclusionReasons: [],
  };
  if (initialScope.admittedPaths.length === 0) {
    throw new Error("A Guard scope manifest must admit at least one path.");
  }
  const overlap = initialScope.admittedPaths.filter((repoPath) =>
    initialScope.excludedPaths.includes(repoPath));
  if (overlap.length > 0) {
    throw new Error(`Paths cannot be both admitted and excluded: ${overlap.join(", ")}`);
  }
  const patterns = [...new Set(sensitivePatterns.map(normalizeRepoPath))].sort();
  const sensitiveAdmission = initialScope.admittedPaths.find((repoPath) =>
    matchesSensitivePath(repoPath, patterns));
  if (sensitiveAdmission) {
    throw new Error(`Sensitive path cannot be admitted initially: ${sensitiveAdmission}`);
  }
  initialScope.inclusionReasons = normalizeInclusionReasons(
    initialScope.admittedPaths,
    inclusionReasons,
  );
  const normalizedTaskId = taskId === null ? null : requireString(taskId, "taskId");
  const manifest = {
    schemaVersion: GUARD_SCOPE_SCHEMA,
    task: {
      id: normalizedTaskId,
      description: requireString(task, "task"),
      evidence: normalizeEvidence(taskEvidence, "taskEvidence"),
    },
    repository: {
      identity: normalizeRepositoryIdentity(repository),
      baseSha: requireCommitOid(baseSha, "baseSha"),
    },
    policy: {
      version: requireString(policyVersion, "policyVersion"),
      enforcement: "authoritative-merge-gate",
      sensitivePatterns: patterns,
    },
    initialScope,
    widens: [],
    scope: {
      admittedPaths: [...initialScope.admittedPaths],
      excludedPaths: [...initialScope.excludedPaths],
      inclusionReasons: initialScope.inclusionReasons.map((entry) => ({
        path: entry.path,
        reasons: [...entry.reasons],
      })),
    },
    createdAt: requireString(createdAt, "createdAt"),
    createdBy: requireString(actor, "actor"),
  };
  return { ...manifest, manifestHash: sha256(canonicalJson(manifest)) };
}

export function verifyScopeManifest(manifest) {
  if (!isPlainObject(manifest)) throw new Error("Guard scope manifest must be a JSON object.");
  if (manifest.schemaVersion !== GUARD_SCOPE_SCHEMA) {
    throw new Error(`Unsupported Guard scope manifest schema: ${manifest.schemaVersion ?? "missing"}`);
  }
  requireString(manifest.task?.description, "task.description");
  requireString(manifest.repository?.identity, "repository.identity");
  requireCommitOid(manifest.repository?.baseSha, "repository.baseSha");
  requireString(manifest.policy?.version, "policy.version");
  if (manifest.policy?.enforcement !== "authoritative-merge-gate") {
    throw new Error("Guard scope manifest enforcement must be authoritative-merge-gate.");
  }
  const sensitivePatterns = uniqueSortedPaths(
    manifest.policy?.sensitivePatterns,
    "policy.sensitivePatterns",
  );
  const initialScope = {
    admittedPaths: uniqueSortedPaths(manifest.initialScope?.admittedPaths, "initialScope.admittedPaths"),
    excludedPaths: uniqueSortedPaths(manifest.initialScope?.excludedPaths, "initialScope.excludedPaths"),
    inclusionReasons: [],
  };
  if (initialScope.admittedPaths.length === 0) {
    throw new Error("A Guard scope manifest must admit at least one path.");
  }
  const initialOverlap = initialScope.admittedPaths.filter((repoPath) =>
    initialScope.excludedPaths.includes(repoPath));
  if (initialOverlap.length > 0) {
    throw new Error(`Paths cannot be both admitted and excluded: ${initialOverlap.join(", ")}`);
  }
  initialScope.inclusionReasons = normalizeInclusionReasons(
    initialScope.admittedPaths,
    manifest.initialScope?.inclusionReasons,
  );
  normalizeEvidence(manifest.task?.evidence, "task.evidence");
  const widens = Array.isArray(manifest.widens) ? manifest.widens : null;
  if (!widens) throw new Error("widens must be an array.");
  let previousEventHash = null;
  for (const [index, event] of widens.entries()) {
    if (!isPlainObject(event)) throw new Error(`Widen ${index} must be an object.`);
    normalizeRepoPath(event.path);
    requireString(event.reason, `widens[${index}].reason`);
    requireString(event.decidedBy, `widens[${index}].decidedBy`);
    requireString(event.decidedAt, `widens[${index}].decidedAt`);
    if (!['approved', 'denied'].includes(event.decision)) {
      throw new Error(`Widen ${index} decision must be approved or denied.`);
    }
    if (event.previousEventHash !== previousEventHash) {
      throw new Error(`Widen ${index} does not extend the prior event hash.`);
    }
    const expectedEventHash = sha256(canonicalJson(widenEventBody(event)));
    if (event.eventHash !== expectedEventHash) {
      throw new Error(`Widen ${index} event hash does not match its contents.`);
    }
    previousEventHash = event.eventHash;
  }
  const expectedScope = currentScope(initialScope, widens);
  const actualScope = {
    admittedPaths: uniqueSortedPaths(manifest.scope?.admittedPaths, "scope.admittedPaths"),
    excludedPaths: uniqueSortedPaths(manifest.scope?.excludedPaths, "scope.excludedPaths"),
    inclusionReasons: normalizeInclusionReasons(
      uniqueSortedPaths(manifest.scope?.admittedPaths, "scope.admittedPaths"),
      manifest.scope?.inclusionReasons,
    ),
  };
  if (canonicalJson(actualScope) !== canonicalJson(expectedScope)) {
    throw new Error("Current Guard scope does not match the initial scope and Widen chain.");
  }
  const sensitiveAdmissions = actualScope.admittedPaths.filter((repoPath) =>
    matchesSensitivePath(repoPath, sensitivePatterns));
  for (const sensitiveAdmission of sensitiveAdmissions) {
    const sensitiveApproval = widens.some((event) =>
      event.path === sensitiveAdmission
      && event.decision === "approved"
      && event.sensitiveOverride === true);
    if (!sensitiveApproval) {
      throw new Error(`Sensitive path lacks an explicit override: ${sensitiveAdmission}`);
    }
  }
  const expectedManifestHash = sha256(canonicalJson(manifestBody(manifest)));
  if (manifest.manifestHash !== expectedManifestHash) {
    throw new Error("Guard scope manifest hash does not match its contents.");
  }
  return manifest;
}

export function widenScopeManifest(manifest, {
  repoPath,
  reason,
  actor,
  decision = "approved",
  decidedAt = new Date().toISOString(),
  allowSensitive = false,
  evidence = [],
}) {
  verifyScopeManifest(manifest);
  const normalizedPath = normalizeRepoPath(repoPath);
  if (!['approved', 'denied'].includes(decision)) {
    throw new Error("Widen decision must be approved or denied.");
  }
  if (manifest.scope.admittedPaths.includes(normalizedPath)) {
    throw new Error(`Path is already admitted: ${normalizedPath}`);
  }
  const sensitive = matchesSensitivePath(normalizedPath, manifest.policy.sensitivePatterns);
  if (decision === "approved" && sensitive && !allowSensitive) {
    throw new Error(
      `Sensitive Widen requires an explicit --allow-sensitive decision: ${normalizedPath}`,
    );
  }
  const previousEventHash = manifest.widens.at(-1)?.eventHash ?? null;
  const eventBody = {
    path: normalizedPath,
    reason: requireString(reason, "reason"),
    decidedBy: requireString(actor, "actor"),
    decidedAt: requireString(decidedAt, "decidedAt"),
    decision,
    sensitiveOverride: sensitive && decision === "approved" ? true : false,
    evidence: normalizeEvidence(evidence, "evidence"),
    previousEventHash,
  };
  const event = {
    ...eventBody,
    eventHash: sha256(canonicalJson(eventBody)),
  };
  const widens = [...manifest.widens, event];
  const next = {
    ...manifestBody(manifest),
    widens,
    scope: currentScope(manifest.initialScope, widens),
  };
  return { ...next, manifestHash: sha256(canonicalJson(next)) };
}

function git(repoDir, args, options = {}) {
  return execFileSync("git", args, {
    cwd: repoDir,
    encoding: options.encoding ?? "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
}

export function readGitIdentity(repoDir) {
  try {
    const remote = git(repoDir, ["config", "--get", "remote.origin.url"]).trim();
    if (remote) return normalizeRepositoryIdentity(remote);
  } catch {
    // A local repository without a remote still has a stable absolute identity.
  }
  return normalizeRepositoryIdentity(path.resolve(repoDir));
}

export function readGitHead(repoDir) {
  try {
    return git(repoDir, ["rev-parse", "HEAD"]).trim();
  } catch {
    throw new Error(`Guard requires a Git repository with at least one commit: ${repoDir}`);
  }
}

function dirtyEntries(repoDir) {
  const output = git(repoDir, ["status", "--porcelain=v1", "-z", "--untracked-files=all"], {
    encoding: "buffer",
  });
  const records = output.toString("utf8").split("\0").filter(Boolean);
  const entries = [];
  for (let index = 0; index < records.length; index++) {
    const record = records[index];
    const status = record.slice(0, 2);
    const repoPath = normalizeRepoPath(record.slice(3));
    entries.push({ status, path: repoPath });
    if (status.includes("R") || status.includes("C")) {
      entries.push({ status, path: normalizeRepoPath(records[++index]) });
    }
  }
  return entries;
}

export function assertCleanGitCheckout(repoDir, allowedUntrackedPaths = []) {
  const allowed = new Set(allowedUntrackedPaths.map(normalizeRepoPath));
  const disallowed = dirtyEntries(repoDir).filter(
    (entry) => entry.status !== "??" || !allowed.has(entry.path),
  );
  if (disallowed.length > 0) {
    const detail = disallowed.map((entry) => `${entry.status} ${entry.path}`).join(", ");
    throw new Error(
      `Guard requires a clean Git checkout so the frozen base and candidate are exact: ${detail}`,
    );
  }
}

function changedPathsFromNameStatus(buffer) {
  const fields = buffer.toString("utf8").split("\0").filter(Boolean);
  const paths = [];
  for (let index = 0; index < fields.length;) {
    const status = fields[index++];
    if (!status) break;
    if (status.startsWith("R") || status.startsWith("C")) {
      paths.push(normalizeRepoPath(fields[index++]));
      paths.push(normalizeRepoPath(fields[index++]));
    } else {
      paths.push(normalizeRepoPath(fields[index++]));
    }
  }
  return [...new Set(paths)].sort();
}

export function inspectGitCandidate(repoDir, baseSha, allowedUntrackedPaths = []) {
  const absoluteRepo = path.resolve(repoDir);
  const candidateSha = readGitHead(absoluteRepo);
  try {
    git(absoluteRepo, ["merge-base", "--is-ancestor", baseSha, candidateSha]);
  } catch {
    throw new Error(`Manifest base ${baseSha} is not an ancestor of candidate ${candidateSha}.`);
  }
  assertCleanGitCheckout(absoluteRepo, allowedUntrackedPaths);
  const changedPaths = changedPathsFromNameStatus(
    git(absoluteRepo, [
      "diff",
      "--name-status",
      "-z",
      "--find-renames",
      baseSha,
      candidateSha,
      "--",
    ], { encoding: "buffer" }),
  );
  const patch = git(absoluteRepo, [
    "diff",
    "--binary",
    "--full-index",
    "--no-ext-diff",
    "--no-renames",
    baseSha,
    candidateSha,
    "--",
  ], { encoding: "buffer" });
  return {
    baseSha,
    candidateSha,
    candidateHash: sha256(patch),
    changedPaths,
  };
}

function buildGuardReceipt({
  manifest,
  candidate,
  enforcementMode,
  manifestTrust,
}) {
  verifyScopeManifest(manifest);
  if (candidate.baseSha !== manifest.repository.baseSha) {
    throw new Error("Candidate base does not match the Guard scope manifest base.");
  }
  const admitted = new Set(manifest.scope.admittedPaths);
  const violations = candidate.changedPaths
    .filter((repoPath) => !admitted.has(repoPath))
    .map((repoPath) => ({
      code: "PATH_OUTSIDE_SCOPE",
      path: repoPath,
      message: `${repoPath} is not admitted by manifest ${manifest.manifestHash}.`,
    }));
  if (candidate.changedPaths.length === 0) {
    violations.push({
      code: "EMPTY_CANDIDATE",
      path: null,
      message: "Candidate contains no changes relative to the manifest base.",
    });
  }
  const body = {
    schemaVersion: GUARD_RECEIPT_SCHEMA,
    verifier: { name: "locus-guard", version: GUARD_VERSION },
    enforcement: {
      mode: enforcementMode,
      result: violations.length === 0 ? "pass" : "fail",
    },
    task: manifest.task,
    repository: {
      identity: manifest.repository.identity,
      baseSha: candidate.baseSha,
      candidateSha: candidate.candidateSha,
    },
    manifest: {
      hash: manifest.manifestHash,
      trust: manifestTrust,
      policyVersion: manifest.policy.version,
      admittedPaths: manifest.scope.admittedPaths,
      inclusionReasons: manifest.scope.inclusionReasons,
      widenEventHashes: manifest.widens.map((event) => event.eventHash),
    },
    candidate: {
      hashAlgorithm: "sha256",
      hash: candidate.candidateHash,
      changedPaths: candidate.changedPaths,
    },
    violations,
    attestation: {
      status: "unsigned",
      note: "Attest this receipt artifact with Sigstore or GitHub artifact attestations.",
    },
  };
  return { ...body, receiptHash: hashObject(body) };
}

export function verifyGitCandidate({
  manifest,
  repoDir,
  expectedManifestHash = null,
  expectedCandidateSha = null,
  advisory = false,
  allowedUntrackedPaths = [],
}) {
  verifyScopeManifest(manifest);
  if (!expectedManifestHash && !advisory) {
    throw new Error(
      "Authoritative Guard verification requires a trusted expected manifest hash.",
    );
  }
  if (expectedManifestHash && expectedManifestHash !== manifest.manifestHash) {
    throw new Error(
      `Guard scope manifest does not match the trusted hash: expected ${expectedManifestHash}, got ${manifest.manifestHash}.`,
    );
  }
  if (!expectedCandidateSha && !advisory) {
    throw new Error(
      "Authoritative Guard verification requires the trusted expected candidate SHA.",
    );
  }
  const identity = readGitIdentity(repoDir);
  if (identity !== manifest.repository.identity) {
    throw new Error(
      `Manifest repository identity does not match this checkout: expected ${manifest.repository.identity}, got ${identity}`,
    );
  }
  const candidate = inspectGitCandidate(
    repoDir,
    manifest.repository.baseSha,
    allowedUntrackedPaths,
  );
  if (expectedCandidateSha && candidate.candidateSha !== expectedCandidateSha) {
    throw new Error(
      `Guard candidate does not match the trusted SHA: expected ${expectedCandidateSha}, got ${candidate.candidateSha}.`,
    );
  }
  return buildGuardReceipt({
    manifest,
    candidate,
    enforcementMode: advisory ? "advisory" : "authoritative-merge-gate",
    manifestTrust: expectedManifestHash ? "expected-hash" : "self-asserted",
  });
}

export function readJsonFile(filePath, label) {
  let text;
  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch {
    throw new Error(`${label} does not exist or is unreadable: ${filePath}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} is not valid JSON: ${filePath}`);
  }
}

function pathIsInside(root, target) {
  const relative = path.relative(root, target);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`));
}

function rejectSymlinkComponents(absolutePath) {
  const parsed = path.parse(absolutePath);
  let current = parsed.root;
  for (const component of absolutePath.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, component);
    try {
      if (fs.lstatSync(current).isSymbolicLink()) {
        throw new Error(`Guard control artifact path contains a symlink: ${current}`);
      }
    } catch (cause) {
      if (cause instanceof Error && cause.message.startsWith("Guard control artifact")) throw cause;
      if (cause?.code === "ENOENT") return;
      throw cause;
    }
  }
}

export function writeFileSafely(filePath, contents, {
  allowedRoot = null,
  mode = 0o600,
  exclusive = false,
} = {}) {
  const absolutePath = path.resolve(filePath);
  const absoluteRoot = allowedRoot ? path.resolve(allowedRoot) : null;
  if (absoluteRoot && !pathIsInside(absoluteRoot, absolutePath)) {
    throw new Error(`Guard control artifact escapes the Repo: ${absolutePath}`);
  }
  if (absoluteRoot) rejectSymlinkComponents(absolutePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  if (absoluteRoot) rejectSymlinkComponents(absolutePath);
  const realParent = fs.realpathSync(path.dirname(absolutePath));
  const outputPath = path.join(realParent, path.basename(absolutePath));
  try {
    if (fs.lstatSync(outputPath).isSymbolicLink()) {
      throw new Error(`Guard control artifact path contains a symlink: ${outputPath}`);
    }
  } catch (cause) {
    if (cause instanceof Error && cause.message.startsWith("Guard control artifact")) throw cause;
    if (cause?.code !== "ENOENT") throw cause;
  }
  if (absoluteRoot) {
    const realRoot = fs.realpathSync(absoluteRoot);
    if (!pathIsInside(realRoot, realParent)) {
      throw new Error(`Guard control artifact parent escapes the Repo: ${realParent}`);
    }
  }
  const flags = fs.constants.O_WRONLY
    | fs.constants.O_CREAT
    | (exclusive ? fs.constants.O_EXCL : fs.constants.O_TRUNC)
    | (fs.constants.O_NOFOLLOW ?? 0);
  const descriptor = fs.openSync(outputPath, flags, mode);
  try {
    fs.writeFileSync(descriptor, contents);
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  return outputPath;
}

export function writeJsonFile(filePath, value, { allowedRoot = null, exclusive = false } = {}) {
  return writeFileSafely(
    filePath,
    `${JSON.stringify(canonicalValue(value), null, 2)}\n`,
    { allowedRoot, exclusive },
  );
}

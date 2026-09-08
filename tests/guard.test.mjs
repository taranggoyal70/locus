import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildGuardReceipt,
  canonicalJson,
  createScopeManifest,
  matchesSensitivePath,
  readGitHead,
  readGitIdentity,
  verifyGitCandidate,
  verifyScopeManifest,
  widenScopeManifest,
} from "../bin/guard.mjs";

const temporaryRepos = [];

function git(repo, args) {
  return execFileSync("git", args, {
    cwd: repo,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function write(repo, repoPath, contents) {
  const target = path.join(repo, repoPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
}

function makeRepo() {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "locus-guard-"));
  temporaryRepos.push(repo);
  git(repo, ["init", "--quiet"]);
  git(repo, ["config", "user.email", "guard@example.com"]);
  git(repo, ["config", "user.name", "Locus Guard test"]);
  write(repo, "src/invoice.js", "export const attempts = 1;\n");
  write(repo, "src/auth.js", "export const secret = 'hidden';\n");
  git(repo, ["add", "."]);
  git(repo, ["commit", "--quiet", "-m", "base"]);
  return repo;
}

function manifestFor(repo, admittedPaths = ["src/invoice.js"]) {
  return createScopeManifest({
    task: "fix duplicate invoice retries",
    taskId: "BILL-142",
    repository: readGitIdentity(repo),
    baseSha: readGitHead(repo),
    admittedPaths,
    excludedPaths: ["src/auth.js"],
    actor: "platform@example.com",
    createdAt: "2026-09-07T00:00:00.000Z",
  });
}

afterEach(() => {
  for (const repo of temporaryRepos.splice(0)) {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

describe("Guard scope manifest", () => {
  it("hashes the same contract identically regardless of object key order", () => {
    expect(canonicalJson({ z: 1, a: { y: 2, x: 3 } })).toBe(
      '{"a":{"x":3,"y":2},"z":1}',
    );
  });

  it("rejects a manifest after any admitted path is changed", () => {
    const repo = makeRepo();
    const manifest = manifestFor(repo);
    const tampered = structuredClone(manifest);
    tampered.scope.admittedPaths.push("src/auth.js");
    expect(() => verifyScopeManifest(tampered)).toThrow(/initial scope and Widen chain/);
  });

  it("records an approved Widen as an append-only hash chain", () => {
    const repo = makeRepo();
    const initial = manifestFor(repo);
    const widened = widenScopeManifest(initial, {
      repoPath: "src/auth.js",
      reason: "stack trace crosses the auth retry adapter",
      actor: "reviewer@example.com",
      decidedAt: "2026-09-07T01:00:00.000Z",
    });

    expect(widened.scope.admittedPaths).toEqual(["src/auth.js", "src/invoice.js"]);
    expect(widened.scope.excludedPaths).toEqual([]);
    expect(widened.widens[0].previousEventHash).toBe(null);
    expect(widened.widens[0].eventHash).toMatch(/^[a-f0-9]{64}$/);
    expect(widened.manifestHash).not.toBe(initial.manifestHash);
    expect(verifyScopeManifest(widened)).toBe(widened);
  });

  it("requires an explicit override before approving a sensitive Widen", () => {
    const repo = makeRepo();
    const manifest = manifestFor(repo);
    expect(matchesSensitivePath("config/prod.key")).toBe(true);
    expect(matchesSensitivePath("prod.key")).toBe(true);
    expect(() => widenScopeManifest(manifest, {
      repoPath: "config/prod.key",
      reason: "inspect signing configuration",
      actor: "reviewer@example.com",
    })).toThrow(/--allow-sensitive/);
  });
});

describe("Guard candidate verification", () => {
  it("passes an exact committed candidate that only changes admitted paths", () => {
    const repo = makeRepo();
    const manifest = manifestFor(repo);
    write(repo, "src/invoice.js", "export const attempts = 2;\n");
    git(repo, ["add", "."]);
    git(repo, ["commit", "--quiet", "-m", "fix retries"]);

    const receipt = verifyGitCandidate({
      manifest,
      repoDir: repo,
      expectedManifestHash: manifest.manifestHash,
    });

    expect(receipt.enforcement.result).toBe("pass");
    expect(receipt.candidate.changedPaths).toEqual(["src/invoice.js"]);
    expect(receipt.candidate.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(receipt.receiptHash).toMatch(/^[a-f0-9]{64}$/);
    expect(receipt.repository.candidateSha).toBe(readGitHead(repo));
    expect(receipt.attestation.status).toBe("unsigned");
  });

  it("fails closed and names every changed path outside the admitted Slice", () => {
    const repo = makeRepo();
    const manifest = manifestFor(repo);
    write(repo, "src/invoice.js", "export const attempts = 2;\n");
    write(repo, "src/auth.js", "export const secret = 'changed';\n");
    write(repo, "src/new.js", "export const newFile = true;\n");
    git(repo, ["add", "."]);
    git(repo, ["commit", "--quiet", "-m", "over-broad fix"]);

    const receipt = verifyGitCandidate({
      manifest,
      repoDir: repo,
      expectedManifestHash: manifest.manifestHash,
    });

    expect(receipt.enforcement.result).toBe("fail");
    expect(receipt.violations).toEqual([
      expect.objectContaining({ code: "PATH_OUTSIDE_SCOPE", path: "src/auth.js" }),
      expect.objectContaining({ code: "PATH_OUTSIDE_SCOPE", path: "src/new.js" }),
    ]);
  });

  it("refuses to hash a dirty candidate because the receipt would be incomplete", () => {
    const repo = makeRepo();
    const manifest = manifestFor(repo);
    write(repo, "src/invoice.js", "export const attempts = 2;\n");
    expect(() => verifyGitCandidate({
      manifest,
      repoDir: repo,
      expectedManifestHash: manifest.manifestHash,
    })).toThrow(/clean working tree/);
  });

  it("refuses authoritative verification without an out-of-band manifest hash", () => {
    const repo = makeRepo();
    const manifest = manifestFor(repo);
    expect(() => verifyGitCandidate({ manifest, repoDir: repo })).toThrow(/trusted expected manifest hash/);
  });

  it("fails an empty candidate instead of producing a meaningless green receipt", () => {
    const repo = makeRepo();
    const manifest = manifestFor(repo);
    const receipt = buildGuardReceipt({
      manifest,
      candidate: {
        baseSha: manifest.repository.baseSha,
        candidateSha: manifest.repository.baseSha,
        candidateHash: "0".repeat(64),
        changedPaths: [],
      },
      verifiedAt: "2026-09-07T02:00:00.000Z",
    });
    expect(receipt.enforcement.result).toBe("fail");
    expect(receipt.violations).toEqual([
      expect.objectContaining({ code: "EMPTY_CANDIDATE" }),
    ]);
  });
});

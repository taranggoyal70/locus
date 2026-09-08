import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const cli = path.resolve("bin/locus.mjs");
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
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "locus-guard-cli-"));
  temporaryRepos.push(repo);
  git(repo, ["init", "--quiet"]);
  git(repo, ["config", "user.email", "guard@example.com"]);
  git(repo, ["config", "user.name", "Locus Guard test"]);
  write(repo, "src/invoice.js", "export function retryInvoice() { return 'retry invoice'; }\n");
  write(repo, "src/unrelated.js", "export const unrelatedSetting = true;\n");
  git(repo, ["add", "."]);
  git(repo, ["commit", "--quiet", "-m", "base"]);
  return repo;
}

function run(repo, args) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: repo,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return { code: result.status, out: result.stdout, err: result.stderr };
}

afterEach(() => {
  for (const repo of temporaryRepos.splice(0)) {
    fs.rmSync(repo, { recursive: true, force: true });
  }
});

describe("locus guard CLI", () => {
  it("creates a focused manifest and verifies an admitted candidate", () => {
    const repo = makeRepo();
    const initialized = run(repo, [
      "guard", "init", "fix invoice retry", "--task-id", "BILL-142", "--actor", "owner@example.com",
      "--evidence", "TypeError: duplicate invoice retry",
    ]);
    expect(initialized.code).toBe(0);
    expect(initialized.out).toMatch(/Admitted 1; excluded 1/);

    const manifest = JSON.parse(fs.readFileSync(path.join(repo, ".locus/scope.json"), "utf8"));
    expect(manifest.scope.admittedPaths).toEqual(["src/invoice.js"]);
    expect(manifest.task.evidence).toEqual([
      expect.objectContaining({ kind: "text", byteLength: 34 }),
    ]);
    expect(manifest.initialScope.inclusionReasons).toEqual([
      expect.objectContaining({ path: "src/invoice.js", reasons: expect.arrayContaining(["task Anchor"]) }),
    ]);

    write(repo, "src/invoice.js", "export function retryInvoice() { return 'retry once'; }\n");
    git(repo, ["add", "src/invoice.js"]);
    git(repo, ["commit", "--quiet", "-m", "fix invoice retry"]);

    const verified = run(repo, [
      "guard", "verify", "--json", "--expected-manifest-hash", manifest.manifestHash,
      "--expected-candidate-sha", git(repo, ["rev-parse", "HEAD"]),
    ]);
    expect(verified.code).toBe(0);
    const receipt = JSON.parse(verified.out);
    expect(receipt.enforcement.result).toBe("pass");
    expect(receipt.candidate.changedPaths).toEqual(["src/invoice.js"]);
    expect(fs.existsSync(path.join(repo, ".locus/receipt.json"))).toBe(true);
  });

  it("returns a failing process and receipt for an out-of-scope candidate", () => {
    const repo = makeRepo();
    expect(run(repo, ["guard", "init", "fix invoice retry"]).code).toBe(0);
    const manifest = JSON.parse(fs.readFileSync(path.join(repo, ".locus/scope.json"), "utf8"));
    write(repo, "src/unrelated.js", "export const unrelatedSetting = false;\n");
    git(repo, ["add", "src/unrelated.js"]);
    git(repo, ["commit", "--quiet", "-m", "touch unrelated code"]);

    const verified = run(repo, [
      "guard", "verify", "--json", "--expected-manifest-hash", manifest.manifestHash,
      "--expected-candidate-sha", git(repo, ["rev-parse", "HEAD"]),
    ]);
    expect(verified.code).toBe(1);
    const receipt = JSON.parse(verified.out);
    expect(receipt.enforcement.result).toBe("fail");
    expect(receipt.violations).toEqual([
      expect.objectContaining({ code: "PATH_OUTSIDE_SCOPE", path: "src/unrelated.js" }),
    ]);
  });

  it("refuses to turn weak localization into a whole-Repo allowlist silently", () => {
    const repo = makeRepo();
    const initialized = run(repo, ["guard", "init", "frobnicate quantum marshmallows"]);
    expect(initialized.code).toBe(1);
    expect(initialized.err).toMatch(/refused a whole-Repo manifest/);
    expect(fs.existsSync(path.join(repo, ".locus/scope.json"))).toBe(false);
  });

  it("refuses to derive a frozen Guard scope manifest from dirty source", () => {
    const repo = makeRepo();
    write(repo, "src/invoice.js", "export function retryInvoice() { return 'dirty'; }\n");
    const initialized = run(repo, ["guard", "init", "fix invoice retry"]);
    expect(initialized.code).toBe(1);
    expect(initialized.err).toMatch(/clean Git checkout/);
  });

  it("does not follow a candidate-controlled receipt symlink", () => {
    const repo = makeRepo();
    expect(run(repo, ["guard", "init", "fix invoice retry"]).code).toBe(0);
    const manifest = JSON.parse(fs.readFileSync(path.join(repo, ".locus/scope.json"), "utf8"));
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), "locus-guard-victim-"));
    temporaryRepos.push(outside);
    const victim = path.join(outside, "victim.txt");
    fs.writeFileSync(victim, "do not overwrite\n");
    fs.symlinkSync(victim, path.join(repo, ".locus/receipt.json"));
    git(repo, ["add", "-f", ".locus/receipt.json"]);
    git(repo, ["commit", "--quiet", "-m", "malicious receipt link"]);

    const verified = run(repo, [
      "guard", "verify",
      "--expected-manifest-hash", manifest.manifestHash,
      "--expected-candidate-sha", git(repo, ["rev-parse", "HEAD"]),
    ]);

    expect(verified.code).toBe(1);
    expect(verified.err).toMatch(/control artifact path contains a symlink/);
    expect(fs.readFileSync(victim, "utf8")).toBe("do not overwrite\n");
  });
});

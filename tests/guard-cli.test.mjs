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

function run(repo, args, options = {}) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: repo,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...options.env },
    timeout: options.timeout ?? 30_000,
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

  it("refuses to place a signing private key inside the target Repo", () => {
    const repo = makeRepo();
    const generated = run(repo, [
      "guard", "keygen",
      "--private-key", ".locus/private.pem",
      "--public-key", ".locus/public.pem",
    ]);

    expect(generated.code).toBe(1);
    expect(generated.err).toMatch(/private keys must be stored outside/);
    expect(fs.existsSync(path.join(repo, ".locus/private.pem"))).toBe(false);
  });

  it.runIf(process.platform === "darwin")(
    "runs a command agent inside the admitted Slice and emits a verifiable signed receipt",
    () => {
      const repo = makeRepo();
      expect(run(repo, ["guard", "init", "fix invoice retry"]).code).toBe(0);
      const manifest = JSON.parse(fs.readFileSync(path.join(repo, ".locus/scope.json"), "utf8"));
      const keyDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "locus-guard-keys-"));
      const agentDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "locus-guard-agent-"));
      temporaryRepos.push(keyDirectory, agentDirectory);
      const privateKey = path.join(keyDirectory, "private.pem");
      const publicKey = path.join(keyDirectory, "public.pem");
      const generated = run(repo, [
        "guard", "keygen", "--private-key", privateKey, "--public-key", publicKey, "--json",
      ]);
      expect(generated.code).toBe(0);
      const key = JSON.parse(generated.out);
      const agentScript = path.join(agentDirectory, "agent.mjs");
      fs.writeFileSync(agentScript, [
        'import fs from "node:fs";',
        'const original = process.argv[2];',
        'try { fs.readFileSync(original); process.exit(41); } catch (cause) {',
        '  if (!["EPERM", "EACCES"].includes(cause.code)) throw cause;',
        '}',
        'fs.writeFileSync("src/invoice.js", "export function retryInvoice() { return \'once\'; }\\n");',
        'console.log(JSON.stringify({ usage: { input_tokens: 120, output_tokens: 35, cached_input_tokens: 20 }, total_cost_usd: 0.014 }));',
      ].join("\n"));

      const executed = run(repo, [
        "guard", "run",
        "--agent", "command",
        "--expected-manifest-hash", manifest.manifestHash,
        "--signing-key", privateKey,
        "--check", `${process.execPath} --check src/invoice.js`,
        "--json",
        "--",
        process.execPath,
        agentScript,
        path.join(repo, "src/unrelated.js"),
      ]);

      expect(executed.code, `${executed.err}\n${executed.out}`).toBe(0);
      const envelope = JSON.parse(executed.out);
      expect(envelope.payload.enforcement.result).toBe("pass");
      expect(envelope.payload.containment).toEqual(expect.objectContaining({
        backend: "macos-seatbelt",
        targetRepo: "inaccessible",
        hostWrites: "ephemeral-only",
      }));
      expect(envelope.payload.candidate.changedPaths).toEqual(["src/invoice.js"]);
      expect(envelope.payload.checks).toEqual([
        expect.objectContaining({ result: "pass", exitCode: 0 }),
      ]);
      expect(envelope.payload.usage).toEqual(expect.objectContaining({
        status: "provider-reported",
        inputTokens: 120,
        outputTokens: 35,
        cachedInputTokens: 20,
        costUsd: 0.014,
      }));
      expect(envelope.payload.review.status).toBe("pending");
      expect(fs.readFileSync(path.join(repo, "src/invoice.js"), "utf8")).toContain("return 'once'");

      const verified = run(repo, [
        "guard", "receipt", "verify",
        "--receipt", ".locus/run-receipt.json",
        "--public-key", publicKey,
        "--expected-key-id", key.keyId,
        "--json",
      ]);
      expect(verified.code).toBe(0);
      expect(JSON.parse(verified.out).candidate.hash).toBe(envelope.payload.candidate.hash);
    },
    30_000,
  );

  it.runIf(process.platform === "darwin")(
    "applies no changes when the contained agent creates a path outside the admitted Slice",
    () => {
      const repo = makeRepo();
      expect(run(repo, ["guard", "init", "fix invoice retry"]).code).toBe(0);
      const manifest = JSON.parse(fs.readFileSync(path.join(repo, ".locus/scope.json"), "utf8"));
      const keyDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "locus-guard-keys-"));
      const agentDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "locus-guard-agent-"));
      temporaryRepos.push(keyDirectory, agentDirectory);
      const privateKey = path.join(keyDirectory, "private.pem");
      const publicKey = path.join(keyDirectory, "public.pem");
      expect(run(repo, [
        "guard", "keygen", "--private-key", privateKey, "--public-key", publicKey,
      ]).code).toBe(0);
      const before = fs.readFileSync(path.join(repo, "src/invoice.js"), "utf8");
      const agentScript = path.join(agentDirectory, "agent.mjs");
      fs.writeFileSync(agentScript, [
        'import fs from "node:fs";',
        'fs.writeFileSync("src/invoice.js", "changed\\n");',
        'fs.writeFileSync("src/not-admitted.js", "escape\\n");',
      ].join("\n"));

      const executed = run(repo, [
        "guard", "run",
        "--agent", "command",
        "--expected-manifest-hash", manifest.manifestHash,
        "--signing-key", privateKey,
        "--",
        process.execPath,
        agentScript,
      ]);

      expect(executed.code).toBe(1);
      expect(executed.err).toMatch(/outside the admitted Slice/);
      expect(fs.readFileSync(path.join(repo, "src/invoice.js"), "utf8")).toBe(before);
    },
    30_000,
  );
});

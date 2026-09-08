import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { canonicalJson, sha256 } from "../bin/guard.mjs";
import { createSignedEnvelope } from "../bin/guard-signing.mjs";

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

  it("refuses an external signing-key symlink that resolves inside the target Repo", () => {
    const repo = makeRepo();
    expect(run(repo, ["guard", "init", "fix invoice retry"]).code).toBe(0);
    const manifest = JSON.parse(fs.readFileSync(path.join(repo, ".locus/scope.json"), "utf8"));
    const keyDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "locus-guard-keys-"));
    temporaryRepos.push(keyDirectory);
    const generatedPrivate = path.join(keyDirectory, "generated-private.pem");
    const publicKey = path.join(keyDirectory, "public.pem");
    expect(run(repo, [
      "guard", "keygen", "--private-key", generatedPrivate, "--public-key", publicKey,
    ]).code).toBe(0);
    const leakedPrivate = path.join(repo, ".locus/leaked-private.pem");
    fs.copyFileSync(generatedPrivate, leakedPrivate);
    const alias = path.join(keyDirectory, "outside-alias.pem");
    fs.symlinkSync(leakedPrivate, alias);

    const executed = run(repo, [
      "guard", "run", "--agent", "command",
      "--expected-manifest-hash", manifest.manifestHash,
      "--signing-key", alias,
      "--", "/usr/bin/true",
    ]);

    expect(executed.code).toBe(1);
    expect(executed.err).toMatch(/private keys must be stored outside/);
  });

  it("binds an immutable human Review to the exact signed proposal", () => {
    const repo = makeRepo();
    const keyDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "locus-guard-keys-"));
    temporaryRepos.push(keyDirectory);
    const privateKey = path.join(keyDirectory, "private.pem");
    const publicKey = path.join(keyDirectory, "public.pem");
    expect(run(repo, [
      "guard", "keygen", "--private-key", privateKey, "--public-key", publicKey,
    ]).code).toBe(0);
    const body = {
      schemaVersion: "locus.guard.run-receipt.v1",
      enforcement: { mode: "contained-agent-run", result: "pass" },
      candidate: { hash: "a".repeat(64), changedPaths: ["src/invoice.js"], records: [] },
      checks: [{ command: "pnpm test", result: "pass", exitCode: 0 }],
      review: { status: "pending" },
      violations: [],
    };
    const payload = { ...body, receiptHash: sha256(canonicalJson(body)) };
    const envelope = createSignedEnvelope({ payload, privateKeyPath: privateKey });
    fs.mkdirSync(path.join(repo, ".locus"), { recursive: true });
    fs.writeFileSync(
      path.join(repo, ".locus/run-receipt.json"),
      `${JSON.stringify(envelope, null, 2)}\n`,
    );

    fs.writeFileSync(path.join(repo, ".locus/run-receipt.json.review.lock"), "busy\n");
    const concurrent = run(repo, [
      "guard", "review", "--receipt", ".locus/run-receipt.json",
      "--public-key", publicKey, "--signing-key", privateKey,
      "--decision", "accepted", "--actor", "reviewer@example.com",
      "--criterion", "Retry is limited to one attempt",
    ]);
    expect(concurrent.code).toBe(1);
    expect(concurrent.err).toMatch(/already locked/);
    fs.unlinkSync(path.join(repo, ".locus/run-receipt.json.review.lock"));

    const reviewed = run(repo, [
      "guard", "review",
      "--receipt", ".locus/run-receipt.json",
      "--public-key", publicKey,
      "--signing-key", privateKey,
      "--decision", "accepted",
      "--actor", "reviewer@example.com",
      "--criterion", "Retry is limited to one attempt",
      "--note", "Diff and Check evidence reviewed",
      "--json",
    ]);

    expect(reviewed.code, reviewed.err).toBe(0);
    const reviewedEnvelope = JSON.parse(reviewed.out);
    expect(reviewedEnvelope.payload.review).toEqual(expect.objectContaining({
      status: "accepted",
      proposalHash: payload.receiptHash,
      decidedBy: "reviewer@example.com",
      criteria: ["Retry is limited to one attempt"],
    }));
    expect(reviewedEnvelope.payload.receiptHash).not.toBe(payload.receiptHash);

    const verified = run(repo, [
      "guard", "receipt", "verify", "--receipt", ".locus/run-receipt.json",
      "--public-key", publicKey, "--json",
    ]);
    expect(verified.code).toBe(0);
    expect(JSON.parse(verified.out).review.status).toBe("accepted");

    const repeated = run(repo, [
      "guard", "review", "--receipt", ".locus/run-receipt.json",
      "--public-key", publicKey, "--signing-key", privateKey,
      "--decision", "rejected", "--actor", "reviewer@example.com",
      "--criterion", "Try again",
    ]);
    expect(repeated.code).toBe(1);
    expect(repeated.err).toMatch(/already has a human Review/);

    const forked = run(repo, [
      "guard", "review", "--receipt", ".locus/run-receipt.json",
      "--out", ".locus/conflicting-review.json",
      "--public-key", publicKey, "--signing-key", privateKey,
      "--decision", "rejected", "--actor", "reviewer@example.com",
      "--criterion", "Try again",
    ]);
    expect(forked.code).toBe(1);
    expect(forked.err).toMatch(/Unknown guard review option: --out/);
  });

  it("refuses to run without a declared Check", () => {
    const repo = makeRepo();
    expect(run(repo, ["guard", "init", "fix invoice retry"]).code).toBe(0);
    const manifest = JSON.parse(fs.readFileSync(path.join(repo, ".locus/scope.json"), "utf8"));
    const keyDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "locus-guard-keys-"));
    temporaryRepos.push(keyDirectory);
    const privateKey = path.join(keyDirectory, "private.pem");
    const publicKey = path.join(keyDirectory, "public.pem");
    expect(run(repo, [
      "guard", "keygen", "--private-key", privateKey, "--public-key", publicKey,
    ]).code).toBe(0);

    const executed = run(repo, [
      "guard", "run", "--agent", "command",
      "--expected-manifest-hash", manifest.manifestHash,
      "--signing-key", privateKey,
      "--", "/usr/bin/true",
    ]);

    expect(executed.code).toBe(1);
    expect(executed.err).toMatch(/requires at least one Check/);
  });

  it("rejects a signed envelope that is not a valid Guard Run receipt", () => {
    const repo = makeRepo();
    const keyDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "locus-guard-keys-"));
    temporaryRepos.push(keyDirectory);
    const privateKey = path.join(keyDirectory, "private.pem");
    const publicKey = path.join(keyDirectory, "public.pem");
    expect(run(repo, [
      "guard", "keygen", "--private-key", privateKey, "--public-key", publicKey,
    ]).code).toBe(0);
    const malformedBody = { schemaVersion: "locus.guard.run-receipt.v1", review: { status: "pending" } };
    const malformed = {
      ...malformedBody,
      receiptHash: sha256(canonicalJson(malformedBody)),
    };
    const envelope = createSignedEnvelope({ payload: malformed, privateKeyPath: privateKey });
    fs.mkdirSync(path.join(repo, ".locus"), { recursive: true });
    fs.writeFileSync(path.join(repo, ".locus/run-receipt.json"), `${JSON.stringify(envelope)}\n`);

    const verified = run(repo, [
      "guard", "receipt", "verify", "--receipt", ".locus/run-receipt.json",
      "--public-key", publicKey,
    ]);

    expect(verified.code).toBe(1);
    expect(verified.err).toMatch(/invalid enforcement evidence/);
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
      const checkScript = path.join(agentDirectory, "check.mjs");
      fs.writeFileSync(agentScript, [
        'import fs from "node:fs";',
        'const original = process.argv[2];',
        'const signingKey = process.argv[3];',
        'if (process.env.LOCUS_GUARD_SIGNING_KEY) process.exit(40);',
        'for (const protectedPath of [original, signingKey]) {',
        '  try { fs.readFileSync(protectedPath); process.exit(41); } catch (cause) {',
        '    if (!["EPERM", "EACCES"].includes(cause.code)) throw cause;',
        '  }',
        '}',
        'fs.writeFileSync("src/invoice.js", "export function retryInvoice() { return \'once\'; }\\n");',
        'console.log("fix invoice retry");',
        'console.log(JSON.stringify({ usage: { input_tokens: 120, output_tokens: 35, cached_input_tokens: 20 }, total_cost_usd: 0.014 }));',
      ].join("\n"));
      fs.writeFileSync(checkScript, [
        'import fs from "node:fs";',
        'try { fs.readFileSync(process.argv[2]); process.exit(61); } catch (cause) {',
        '  if (!["EPERM", "EACCES"].includes(cause.code)) throw cause;',
        '}',
        'if (!fs.readFileSync("src/invoice.js", "utf8").includes("return \'once\'")) process.exit(62);',
      ].join("\n"));

      const executed = run(repo, [
        "guard", "run",
        "--agent", "command",
        "--expected-manifest-hash", manifest.manifestHash,
        "--check", `${process.execPath} ${checkScript} ${privateKey}`,
        "--json",
        "--",
        process.execPath,
        agentScript,
        path.join(repo, "src/unrelated.js"),
        privateKey,
      ], { env: { LOCUS_GUARD_SIGNING_KEY: privateKey } });

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
      expect(envelope.payload.task.description).toEqual(expect.objectContaining({
        digest: expect.stringMatching(/^[a-f0-9]{64}$/),
        byteLength: 17,
      }));
      expect(envelope.payload.task.description).not.toHaveProperty("text");
      expect(envelope.payload.execution.evidence.stdout.relevantOutput).toContain("[REDACTED_PROMPT]");
      expect(envelope.payload.execution.evidence.stdout.relevantOutput).not.toContain("fix invoice retry");
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
    "executes the Codex and Claude adapters with their non-interactive protocols",
    () => {
      for (const adapter of ["codex", "claude"]) {
        const repo = makeRepo();
        expect(run(repo, ["guard", "init", "fix invoice retry"]).code).toBe(0);
        const manifest = JSON.parse(fs.readFileSync(path.join(repo, ".locus/scope.json"), "utf8"));
        const keyDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "locus-guard-keys-"));
        const agentDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "locus-guard-adapter-"));
        temporaryRepos.push(keyDirectory, agentDirectory);
        const privateKey = path.join(keyDirectory, "private.pem");
        const publicKey = path.join(keyDirectory, "public.pem");
        expect(run(repo, [
          "guard", "keygen", "--private-key", privateKey, "--public-key", publicKey,
        ]).code).toBe(0);
        const executable = path.join(agentDirectory, adapter);
        fs.writeFileSync(executable, [
          "#!/usr/bin/env node",
          'import fs from "node:fs";',
          `const adapter = ${JSON.stringify(adapter)};`,
          'const args = process.argv.slice(2);',
          'if (adapter === "codex" && !args.includes("exec")) process.exit(51);',
          'if (adapter === "codex" && !args.includes("--json")) process.exit(52);',
          'if (adapter === "claude" && !args.includes("--no-session-persistence")) process.exit(53);',
          'if (adapter === "claude" && !args.includes("--safe-mode")) process.exit(54);',
          'if (args.at(-1) !== "fix invoice retry") process.exit(55);',
          'fs.writeFileSync("src/invoice.js", `export const adapter = "${adapter}";\\n`);',
          'console.log(JSON.stringify({ usage: { input_tokens: 9, output_tokens: 4 } }));',
        ].join("\n"), { mode: 0o755 });

        const executed = run(repo, [
          "guard", "run", "--agent", adapter,
          "--expected-manifest-hash", manifest.manifestHash,
          "--signing-key", privateKey,
          "--check", `${process.execPath} --check src/invoice.js`,
          "--json",
        ], { env: { PATH: `${agentDirectory}${path.delimiter}${process.env.PATH}` } });

        expect(executed.code, `${adapter}: ${executed.err}\n${executed.out}`).toBe(0);
        const envelope = JSON.parse(executed.out);
        expect(envelope.payload.execution.agent).toBe(adapter);
        expect(envelope.payload.usage).toEqual(expect.objectContaining({
          provider: adapter === "codex" ? "openai" : "anthropic",
          inputTokens: 9,
          outputTokens: 4,
        }));
      }
    },
    30_000,
  );

  it.runIf(process.platform === "darwin")(
    "restores the Repo when receipt signing fails after a passing candidate",
    () => {
      const repo = makeRepo();
      expect(run(repo, ["guard", "init", "fix invoice retry"]).code).toBe(0);
      const manifest = JSON.parse(fs.readFileSync(path.join(repo, ".locus/scope.json"), "utf8"));
      const keyDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "locus-guard-keys-"));
      const agentDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "locus-guard-agent-"));
      temporaryRepos.push(keyDirectory, agentDirectory);
      const invalidPrivateKey = path.join(keyDirectory, "invalid-private.pem");
      fs.writeFileSync(invalidPrivateKey, "not a private key\n", { mode: 0o600 });
      const before = fs.readFileSync(path.join(repo, "src/invoice.js"), "utf8");
      const agentScript = path.join(agentDirectory, "agent.mjs");
      fs.writeFileSync(agentScript, 'import fs from "node:fs"; fs.writeFileSync("src/invoice.js", "candidate\\n");\n');

      const executed = run(repo, [
        "guard", "run", "--agent", "command",
        "--expected-manifest-hash", manifest.manifestHash,
        "--signing-key", invalidPrivateKey,
        "--check", "/usr/bin/true",
        "--", process.execPath, agentScript,
      ]);

      expect(executed.code).toBe(1);
      expect(executed.err).toMatch(/private key|decoder|unsupported/i);
      expect(fs.readFileSync(path.join(repo, "src/invoice.js"), "utf8")).toBe(before);
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
        'fs.symlinkSync("src/invoice.js", "src/not-admitted-link.js");',
      ].join("\n"));

      const executed = run(repo, [
        "guard", "run",
        "--agent", "command",
        "--expected-manifest-hash", manifest.manifestHash,
        "--signing-key", privateKey,
        "--check", "/usr/bin/true",
        "--",
        process.execPath,
        agentScript,
      ]);

      expect(executed.code).toBe(1);
      expect(executed.err).toMatch(/outside the admitted Slice/);
      expect(fs.readFileSync(path.join(repo, "src/invoice.js"), "utf8")).toBe(before);
      const receipt = JSON.parse(
        fs.readFileSync(path.join(repo, ".locus/run-receipt.json"), "utf8"),
      );
      expect(receipt.payload.candidate.changedPaths).toEqual([
        "src/invoice.js",
        "src/not-admitted-link.js",
        "src/not-admitted.js",
      ]);
      expect(receipt.payload.candidate.records).toEqual(expect.arrayContaining([
        expect.objectContaining({
          path: "src/not-admitted.js",
          state: "created-outside-scope",
          contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
        expect.objectContaining({
          path: "src/not-admitted-link.js",
          state: "unsafe-outside-scope",
          fileType: "symbolic-link",
          contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      ]));
    },
    30_000,
  );

  it.runIf(process.platform === "darwin")(
    "discards ignored Check artifacts with the disposable worktree",
    () => {
      const repo = makeRepo();
      write(repo, ".gitignore", ".cache/\n");
      git(repo, ["add", ".gitignore"]);
      git(repo, ["commit", "--quiet", "-m", "ignore check cache"]);
      expect(run(repo, ["guard", "init", "fix invoice retry"]).code).toBe(0);
      const manifest = JSON.parse(fs.readFileSync(path.join(repo, ".locus/scope.json"), "utf8"));
      const keyDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "locus-guard-keys-"));
      const scriptDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "locus-guard-check-"));
      temporaryRepos.push(keyDirectory, scriptDirectory);
      const privateKey = path.join(keyDirectory, "private.pem");
      const publicKey = path.join(keyDirectory, "public.pem");
      expect(run(repo, [
        "guard", "keygen", "--private-key", privateKey, "--public-key", publicKey,
      ]).code).toBe(0);
      const agentScript = path.join(scriptDirectory, "agent.mjs");
      const checkScript = path.join(scriptDirectory, "check.mjs");
      fs.writeFileSync(agentScript, 'import fs from "node:fs"; fs.writeFileSync("src/invoice.js", "candidate\\n");\n');
      fs.writeFileSync(checkScript, 'import fs from "node:fs"; fs.mkdirSync(".cache", { recursive: true }); fs.writeFileSync(".cache/result", "generated\\n");\n');

      const executed = run(repo, [
        "guard", "run", "--agent", "command",
        "--expected-manifest-hash", manifest.manifestHash,
        "--signing-key", privateKey,
        "--check", `${process.execPath} ${checkScript}`,
        "--json", "--", process.execPath, agentScript,
      ]);

      expect(executed.code, executed.err).toBe(0);
      expect(fs.existsSync(path.join(repo, ".cache/result"))).toBe(false);
      expect(fs.readFileSync(path.join(repo, "src/invoice.js"), "utf8")).toBe("candidate\n");
    },
    30_000,
  );

  it.runIf(process.platform === "darwin")(
    "rolls the candidate back when a Check fails",
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
        'fs.writeFileSync("src/invoice.js", "changed by agent\\n");',
      ].join("\n"));

      const executed = run(repo, [
        "guard", "run", "--agent", "command",
        "--expected-manifest-hash", manifest.manifestHash,
        "--signing-key", privateKey,
        "--check", "/usr/bin/false",
        "--", process.execPath, agentScript,
      ]);

      expect(executed.code).toBe(1);
      expect(fs.readFileSync(path.join(repo, "src/invoice.js"), "utf8")).toBe(before);
      const receipt = JSON.parse(fs.readFileSync(path.join(repo, ".locus/run-receipt.json"), "utf8"));
      expect(receipt.payload.violations).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: "CHECK_FAILED" }),
      ]));
    },
    30_000,
  );

  it.runIf(process.platform === "darwin")(
    "detects Check mutations and restores the clean base",
    () => {
      const repo = makeRepo();
      expect(run(repo, ["guard", "init", "fix invoice retry"]).code).toBe(0);
      const manifest = JSON.parse(fs.readFileSync(path.join(repo, ".locus/scope.json"), "utf8"));
      const keyDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "locus-guard-keys-"));
      const scriptDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "locus-guard-check-"));
      temporaryRepos.push(keyDirectory, scriptDirectory);
      const privateKey = path.join(keyDirectory, "private.pem");
      const publicKey = path.join(keyDirectory, "public.pem");
      expect(run(repo, [
        "guard", "keygen", "--private-key", privateKey, "--public-key", publicKey,
      ]).code).toBe(0);
      const before = fs.readFileSync(path.join(repo, "src/invoice.js"), "utf8");
      const agentScript = path.join(scriptDirectory, "agent.mjs");
      const checkScript = path.join(scriptDirectory, "check.mjs");
      fs.writeFileSync(agentScript, 'import fs from "node:fs"; fs.writeFileSync("src/invoice.js", "candidate\\n");\n');
      fs.writeFileSync(checkScript, 'import fs from "node:fs"; fs.writeFileSync("src/invoice.js", "tampered\\n");\n');

      const executed = run(repo, [
        "guard", "run", "--agent", "command",
        "--expected-manifest-hash", manifest.manifestHash,
        "--signing-key", privateKey,
        "--check", `${process.execPath} ${checkScript}`,
        "--", process.execPath, agentScript,
      ]);

      expect(executed.code).toBe(1);
      expect(fs.readFileSync(path.join(repo, "src/invoice.js"), "utf8")).toBe(before);
      const receipt = JSON.parse(fs.readFileSync(path.join(repo, ".locus/run-receipt.json"), "utf8"));
      expect(receipt.payload.violations).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: "CHECK_MUTATED_CANDIDATE" }),
      ]));
    },
    30_000,
  );
});

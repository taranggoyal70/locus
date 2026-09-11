import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(repoRoot, "cli", "locus.mjs");

/**
 * End to end over the real binary: a temporary source tree, the published CLI,
 * and an HTTP server standing in for /api/v1/locate.
 *
 * The unit tests cover the pieces. This covers the thing that actually broke
 * when localization moved server-side — that the CLI walks a tree, ships it,
 * and renders what comes back — which no amount of mocking `fetch` proves.
 */
// Spawns real child processes, so the per-test budget matches the spawn
// timeout below rather than vitest's 5s default: under parallel load these
// were failing on the clock, not on behaviour.
describe("locus CLI against a Locus API", { timeout: 30_000 }, () => {
  let server;
  let baseUrl;
  let workspace;
  let received;

  beforeAll(async () => {
    workspace = mkdtempSync(path.join(tmpdir(), "locus-e2e-"));
    mkdirSync(path.join(workspace, "src"), { recursive: true });
    writeFileSync(
      path.join(workspace, "src", "checkout.ts"),
      "import { total } from './total';\nexport function checkout() { return total(); }\n",
    );
    writeFileSync(path.join(workspace, "src", "total.ts"), "export function total() { return 42; }\n");

    server = createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        received = { url: req.url, auth: req.headers.authorization, body: JSON.parse(body) };
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({
          task: received.body.task,
          widened: false,
          reason: "matched checkout",
          anchors: ["src/checkout.ts"],
          slice: [{ path: "src/checkout.ts", tokens: 12, distance: 0, recent: false }],
          excluded: ["src/total.ts"],
          tokens: { included: 12, total: 24 },
          graph: { edgeDensity: 1, sparse: false },
          coverage: { matchedFiles: 2, analyzedFiles: 2, truncated: false, limit: 200 },
          context: "===== src/checkout.ts =====\nstub",
        }));
      });
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(() => {
    server?.close();
    if (workspace) rmSync(workspace, { recursive: true, force: true });
  });

  // Async on purpose: spawnSync blocks this process, which is also the one
  // hosting the stub server, so a synchronous child can never be answered and
  // every request deadlocks until the client's own timeout fires.
  function run(args) {
    return new Promise((resolve) => {
      const child = spawn(process.execPath, [cli, ...args], {
        env: { ...process.env, LOCUS_API_KEY: "", LOCUS_API_URL: "" },
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => { stdout += chunk; });
      child.stderr.on("data", (chunk) => { stderr += chunk; });
      child.on("close", (status) => resolve({ status, stdout, stderr }));
    });
  }

  it("uploads the working tree and renders the Slice", async () => {
    const result = await run([
      "locate", "fix the checkout total",
      "--path", workspace,
      "--api-url", baseUrl,
      "--api-key", "lk_e2e",
    ]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("src/checkout.ts");

    expect(received.url).toBe("/api/v1/locate");
    expect(received.auth).toBe("Bearer lk_e2e");
    expect(received.body.task).toBe("fix the checkout total");
    // The source itself is what travels now. That is the product decision this
    // whole path rests on, so it is asserted rather than assumed.
    expect(received.body.files["src/checkout.ts"]).toContain("export function checkout()");
    expect(received.body.files["src/total.ts"]).toContain("return 42");
  });

  it("emits machine-readable output for an agent", async () => {
    const result = await run([
      "locate", "fix the checkout total",
      "--path", workspace,
      "--api-url", baseUrl,
      "--api-key", "lk_e2e",
      "--json",
    ]);

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.slice.map((f) => f.path ?? f)).toContainEqual(expect.stringContaining("checkout.ts"));
  });

  it("exits non-zero with a readable message when no key is configured", async () => {
    const result = await run(["locate", "anything", "--path", workspace, "--api-url", baseUrl]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("No API key");
    // A stack trace here would bury the one line the developer needs. Matching
    // indented frames, not the bare word: the message itself says "API at ...".
    expect(result.stderr).not.toMatch(/\n\s+at /);
  });

  it("reports an API failure without a stack trace", async () => {
    const result = await run([
      "locate", "anything",
      "--path", workspace,
      "--api-url", "http://127.0.0.1:1",
      "--api-key", "lk_e2e",
    ]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Could not reach the Locus API");
    expect(result.stderr).not.toMatch(/\n\s+at /);
  });
});

import { spawn } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const created = [];

afterEach(() => {
  for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/**
 * Build the directory shape npm actually installs: the entrypoints at the
 * package root, the manifest beside them, and no manifest in the directory above
 * - which is node_modules in a real install.
 */
function installedPackage() {
  const root = mkdtempSync(path.join(tmpdir(), "locus-node-modules-"));
  created.push(root);
  const pkgDir = path.join(root, "locus-context");
  cpSync(path.join(repoRoot, "cli"), pkgDir, { recursive: true });
  return pkgDir;
}

function bannerOf(entrypoint) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [entrypoint], { stdio: ["pipe", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      if (stderr.includes("ready")) {
        child.kill();
        resolve(stderr);
      }
    });
    child.on("close", () => resolve(stderr));
  });
}

describe("published package layout", () => {
  it("reports its real version when installed the way npm installs it", async () => {
    // The previous implementation looked only one level up for the manifest.
    // That resolves in this repository, where the entrypoint is in bin/, and
    // fails in every npm install, where one level up is node_modules. It
    // reported 0.1.0 to every MCP client that completed a handshake.
    const expected = JSON.parse(
      readFileSync(path.join(repoRoot, "cli", "package.json"), "utf8"),
    ).version;

    const banner = await bannerOf(path.join(installedPackage(), "mcp.mjs"));
    expect(banner).toContain(`v${expected}`);
    expect(banner).not.toContain("v0.1.0");
  }, 20_000);

  it("ignores an unrelated manifest sitting above the package", async () => {
    // A dependency directory can have anything above it. Reporting a neighbour's
    // version as this server's would be worse than reporting none.
    const pkgDir = installedPackage();
    writeFileSync(
      path.join(pkgDir, "..", "package.json"),
      JSON.stringify({ name: "someone-elses-app", version: "9.9.9" }),
    );

    const banner = await bannerOf(path.join(pkgDir, "mcp.mjs"));
    expect(banner).not.toContain("9.9.9");
  }, 20_000);

  it("keeps working from a source checkout, where the manifest is one level up", async () => {
    const expected = JSON.parse(
      readFileSync(path.join(repoRoot, "package.json"), "utf8"),
    ).version;

    const banner = await bannerOf(path.join(repoRoot, "bin", "mcp.mjs"));
    expect(banner).toContain(`v${expected}`);
  }, 20_000);
});

import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliDir = path.join(repoRoot, "cli");

const rootManifest = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
const cliManifest = JSON.parse(readFileSync(path.join(cliDir, "package.json"), "utf8"));

describe("locus-context package", () => {
  it("carries the same version as the application", () => {
    // `pnpm check-sync` diffs the three .mjs files and stops there, so the two
    // manifests could drift silently. They must not: the MCP server reads its
    // version from whichever manifest is beside it, so a drift means the same
    // build advertises one version from a checkout and another from an install.
    expect(cliManifest.version).toBe(rootManifest.version);
  });

  it("declares every bin target that exists and no target that does not", () => {
    for (const [name, relative] of Object.entries(cliManifest.bin)) {
      const target = path.join(cliDir, relative);
      expect(statSync(target).isFile(), `${name} -> ${relative}`).toBe(true);
    }
  });

  it("gives every bin entrypoint a shebang", () => {
    // npm creates the launcher shim from `bin`, but a direct execution or a
    // shim that falls through to exec relies on the interpreter line. It costs
    // nothing to keep and breaks confusingly when it is missing.
    for (const relative of new Set(Object.values(cliManifest.bin))) {
      const source = readFileSync(path.join(cliDir, relative), "utf8");
      expect(source.startsWith("#!/usr/bin/env node"), relative).toBe(true);
    }
  });

  it("ships the license it claims", () => {
    expect(cliManifest.license).toBe("MIT");
    expect(cliManifest.files).toContain("LICENSE");
    const shipped = readFileSync(path.join(cliDir, "LICENSE"), "utf8");
    expect(shipped).toBe(readFileSync(path.join(repoRoot, "LICENSE"), "utf8"));
  });

  it("stays dependency-free, which is the package's whole claim", () => {
    // The description and README both say "zero-dependency". A single runtime
    // dependency would make that false in the registry listing itself.
    expect(cliManifest.dependencies ?? {}).toEqual({});
    expect(cliManifest.description).toContain("Zero-dependency");
  });

  it("publishes publicly with provenance", () => {
    expect(cliManifest.publishConfig).toEqual({ access: "public", provenance: true });
  });
});

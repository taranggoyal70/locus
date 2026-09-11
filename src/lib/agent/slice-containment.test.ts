import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CONTAINMENT_PRELUDE, SLICE_ENV } from "@/lib/agent/workspace";

// R14: the Slice boundary, executed where the read happens.
//
// WorkspaceController refuses an out-of-Slice path before composing a command,
// but that check lives in the composing process. These tests run the shipped
// containment script against a real filesystem with a real allowlist, because
// the claim being sold — an Agent cannot read outside its approved Slice — is
// behavioural. A path inside the workspace but outside the Slice must actually
// fail, not merely be refused by the caller that chose to ask.

let root: string;

const PROBE = `${CONTAINMENT_PRELUDE}process.stdout.write(contain(process.env.LOCUS_PATH));`;

function contain(target: string, slice?: string[]): string {
  const env: NodeJS.ProcessEnv = { ...process.env, LOCUS_PATH: target };
  if (slice !== undefined) env[SLICE_ENV] = JSON.stringify(slice);
  return execFileSync(process.execPath, ["-e", PROBE], {
    cwd: root,
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

beforeAll(() => {
  root = realpathSync(mkdtempSync(path.join(tmpdir(), "locus-slice-")));
  mkdirSync(path.join(root, "src"), { recursive: true });
  mkdirSync(path.join(root, "config"), { recursive: true });
  writeFileSync(path.join(root, "src", "included.ts"), "export const value = 1;");
  writeFileSync(path.join(root, "src", "excluded.ts"), "export const other = 2;");
  writeFileSync(path.join(root, "config", "secrets.ts"), "export const KEY = 'shh';");
});

afterAll(() => {
  if (root) rmSync(root, { recursive: true, force: true });
});

// Spawns real child processes, so the per-test budget matches the spawn
// timeout below rather than vitest's 5s default: under parallel load these
// were failing on the clock, not on behaviour.
describe("Slice containment inside the sandbox", { timeout: 30_000 }, () => {
  it("admits a path the Slice lists", () => {
    const resolved = contain("src/included.ts", ["src/included.ts"]);
    expect(resolved).toBe(path.join(root, "src", "included.ts"));
  });

  // The heart of it: this path is inside the workspace and passes every check
  // the old prelude made. Only the Slice allowlist refuses it.
  it("refuses a path inside the workspace but outside the Slice", () => {
    expect(() => contain("src/excluded.ts", ["src/included.ts"]))
      .toThrow(/outside the active Slice: src\/excluded\.ts/);
  });

  it("refuses a sensitive file the Slice does not list", () => {
    expect(() => contain("config/secrets.ts", ["src/included.ts"]))
      .toThrow(/outside the active Slice/);
  });

  it("refuses everything when the Slice is empty", () => {
    expect(() => contain("src/included.ts", [])).toThrow(/outside the active Slice/);
  });

  it("still refuses a workspace escape, allowlist or not", () => {
    // Slice admission must not become a way around the older boundary: the
    // escape check runs first and does not consult the allowlist.
    expect(() => contain("../outside.ts", ["../outside.ts"]))
      .toThrow(/path escapes the workspace/);
  });

  it("normalises a path before matching, so a detour cannot dodge the list", () => {
    // `src/../src/excluded.ts` resolves to an unlisted file. Matching the raw
    // argument instead of the resolved relative path would admit it.
    expect(() => contain("src/../src/excluded.ts", ["src/included.ts"]))
      .toThrow(/outside the active Slice: src\/excluded\.ts/);
  });

  it("admits a listed path reached by a detour, because the check is on the resolved path", () => {
    const resolved = contain("src/../src/included.ts", ["src/included.ts"]);
    expect(resolved).toBe(path.join(root, "src", "included.ts"));
  });

  // Repository-wide operations (diff, status, dependency install) have no Slice.
  // Absence has to keep meaning unrestricted or those break.
  it("is unrestricted when no allowlist is set", () => {
    const resolved = contain("src/excluded.ts");
    expect(resolved).toBe(path.join(root, "src", "excluded.ts"));
  });

  it("is unrestricted when the allowlist is the empty string", () => {
    const resolved = execFileSync(process.execPath, ["-e", PROBE], {
      cwd: root,
      env: { ...process.env, LOCUS_PATH: "src/excluded.ts", [SLICE_ENV]: "" },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    expect(resolved).toBe(path.join(root, "src", "excluded.ts"));
  });

  // Failing closed on a malformed list matters: silently treating it as absent
  // would turn a serialization bug into an unrestricted Agent.
  it("refuses a malformed allowlist rather than falling back to unrestricted", () => {
    expect(() => execFileSync(process.execPath, ["-e", PROBE], {
      cwd: root,
      env: { ...process.env, LOCUS_PATH: "src/included.ts", [SLICE_ENV]: "{not json" },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })).toThrow(/malformed slice allowlist/);
  });

  it("refuses an allowlist that is not an array", () => {
    expect(() => execFileSync(process.execPath, ["-e", PROBE], {
      cwd: root,
      env: { ...process.env, LOCUS_PATH: "src/included.ts", [SLICE_ENV]: '{"src/included.ts":true}' },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })).toThrow(/malformed slice allowlist/);
  });
});

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CONTAINMENT_PRELUDE } from "@/lib/agent/workspace";

// R3: lexical path validation cannot defeat repository-controlled symlinks.
// These tests execute the containment script that ships inside the sandbox
// against a real filesystem, because the security property is behavioural: a
// symlinked escape must actually fail, not merely be described in a comment.

let root: string;
let outside: string;

// Resolve the workspace through the script itself, then report the path it
// accepted, so a passing case proves the real target was reached.
const PROBE = `${CONTAINMENT_PRELUDE}process.stdout.write(contain(process.env.LOCUS_PATH));`;

function contain(target: string, cwd = root): string {
  return execFileSync(process.execPath, ["-e", PROBE], {
    cwd,
    env: { ...process.env, LOCUS_PATH: target },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

beforeAll(() => {
  // realpath the fixtures: on macOS tmpdir() is /var/..., itself a symlink to
  // /private/var/..., and the script resolves cwd before comparing.
  root = realpathSync(mkdtempSync(path.join(tmpdir(), "locus-contain-")));
  outside = realpathSync(mkdtempSync(path.join(tmpdir(), "locus-outside-")));
  writeFileSync(path.join(outside, "secret.env"), "STOLEN=1");
  mkdirSync(path.join(root, "src"), { recursive: true });
  writeFileSync(path.join(root, "src", "included.ts"), "export const value = 1;");
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(outside, { recursive: true, force: true });
});

describe("sandbox path containment", () => {
  it("accepts an ordinary path inside the workspace", () => {
    expect(contain("src/included.ts")).toBe(path.join(root, "src/included.ts"));
  });

  it("accepts a path that does not exist yet so new files can be created", () => {
    expect(contain("src/created/new.ts")).toBe(path.join(root, "src/created/new.ts"));
  });

  it("rejects a symlinked file that resolves outside the workspace", () => {
    symlinkSync(path.join(outside, "secret.env"), path.join(root, "leak.env"));

    expect(() => contain("leak.env")).toThrow(/symlink rejected: leak\.env/);
  });

  it("rejects a path beneath a symlinked parent directory", () => {
    symlinkSync(outside, path.join(root, "escape"));

    // The final component does not exist and is not itself a link — only the
    // component walk catches this.
    expect(() => contain("escape/secret.env")).toThrow(/symlink rejected: escape/);
  });

  it("rejects traversal that climbs out of the workspace", () => {
    expect(() => contain("../secret.env")).toThrow(/path escapes the workspace/);
  });

  it("rejects an absolute path outside the workspace", () => {
    expect(() => contain(path.join(outside, "secret.env"))).toThrow(/path escapes the workspace/);
  });

  it("rejects the workspace root itself", () => {
    expect(() => contain(".")).toThrow(/path escapes the workspace/);
  });

  it("rejects a non-regular file", () => {
    const fifo = path.join(root, "pipe");
    execFileSync("mkfifo", [fifo]);

    expect(() => contain("pipe")).toThrow(/special file rejected: pipe/);
  });

  it("rejects an empty path", () => {
    expect(() => contain("")).toThrow(/missing path/);
  });
});

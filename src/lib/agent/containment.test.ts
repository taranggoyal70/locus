import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  CONTAINMENT_PRELUDE,
  READ_SLICE_SCRIPT,
  SEARCH_SCRIPT,
} from "@/lib/agent/workspace";

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

function readWindow(target: string, offset: number, maxCharacters: number): string {
  return execFileSync(process.execPath, ["-e", READ_SLICE_SCRIPT], {
    cwd: root,
    env: {
      ...process.env,
      LOCUS_PATH: target,
      LOCUS_OFFSET: String(offset),
      LOCUS_MAX_CHARACTERS: String(maxCharacters),
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

describe("slice read paging", () => {
  it("returns exact adjacent windows without skipping a long source line", () => {
    writeFileSync(
      path.join(root, "src", "large.ts"),
      `${"A".repeat(10_000)}${"B".repeat(10_000)}TAIL`,
    );

    const first = readWindow("src/large.ts", 0, 10_000);
    const second = readWindow("src/large.ts", 10_000, 10_000);
    const tail = readWindow("src/large.ts", 20_000, 10_000);

    expect(first).toBe(`characters 0-10000 of 20004\n${"A".repeat(10_000)}`);
    expect(second).toBe(`characters 10000-20000 of 20004\n${"B".repeat(10_000)}`);
    expect(tail).toBe("characters 20000-20004 of 20004\nTAIL");
  });

  it("never splits a non-BMP Unicode character at a window boundary", () => {
    writeFileSync(
      path.join(root, "src", "unicode.ts"),
      `${"A".repeat(9_999)}😀B`,
    );

    const first = readWindow("src/unicode.ts", 0, 10_000);
    const second = readWindow("src/unicode.ts", 10_000, 10_000);

    expect(first).toBe(`characters 0-10000 of 10001\n${"A".repeat(9_999)}😀`);
    expect(second).toBe("characters 10000-10001 of 10001\nB");
    expect(first).not.toContain("�");
  });
});

// R3 residual: search used to hand Slice paths to `rg` as explicit arguments.
// ripgrep does not follow symlinks while walking a directory, but it does read a
// symlinked path passed explicitly, so an admitted path that is a symlink printed
// a file from outside the workspace. Verified against ripgrep 14.1.1 before this
// changed. These tests run the replacement script against a real filesystem.
function search(paths: string[], query: string, cwd = root) {
  const result = spawnSync(process.execPath, ["-e", SEARCH_SCRIPT], {
    cwd,
    env: {
      ...process.env,
      LOCUS_QUERY: query,
      LOCUS_PATHS: JSON.stringify(paths),
    },
    encoding: "utf8",
  });
  return { stdout: result.stdout, stderr: result.stderr, status: result.status };
}

describe("slice search containment", () => {
  // Own fixtures rather than the symlinks the cases above create inside their
  // `it` bodies, so these tests do not depend on execution order.
  beforeAll(() => {
    symlinkSync(path.join(outside, "secret.env"), path.join(root, "search-leak.env"));
    symlinkSync(outside, path.join(root, "search-escape"));
  });

  it("finds matches in an ordinary file inside the workspace", () => {
    const { stdout } = search(["src/included.ts"], "value");

    expect(stdout).toContain("src/included.ts:1:export const value = 1;");
  });

  it("does not read a symlinked path that resolves outside the workspace", () => {
    // The exact leak: `rg -n --fixed-strings -- STOLEN leak.env` printed this.
    const { stdout, stderr } = search(["search-leak.env"], "STOLEN");

    expect(stdout).not.toContain("STOLEN");
    expect(stderr).toMatch(/refused 1 path\(s\) that failed containment/);
    expect(stderr).toMatch(/search-leak\.env: symlink rejected/);
  });

  it("still searches the contained paths when one path is refused", () => {
    // A refused entry must not abort the whole search, or a single hostile
    // symlink would blind the Agent to the rest of its Slice.
    const { stdout, stderr } = search(["search-leak.env", "src/included.ts"], "value");

    expect(stdout).toContain("src/included.ts:1:");
    expect(stderr).toMatch(/search-leak\.env/);
  });

  it("does not read a file beneath a symlinked parent directory", () => {
    const { stdout, stderr } = search(["search-escape/secret.env"], "STOLEN");

    expect(stdout).not.toContain("STOLEN");
    expect(stderr).toMatch(/symlink rejected: search-escape/);
  });

  it("refuses a path that climbs out of the workspace", () => {
    const { stdout, stderr } = search(["../secret.env"], "STOLEN");

    expect(stdout).not.toContain("STOLEN");
    expect(stderr).toMatch(/path escapes the workspace/);
  });

  it("skips a binary file rather than decoding it into the evidence", () => {
    writeFileSync(path.join(root, "src", "blob.bin"), Buffer.from([0x00, 0x66, 0x6f, 0x6f]));

    const { stdout } = search(["src/blob.bin"], "foo");

    expect(stdout).not.toContain("blob.bin:");
  });

  it("stops at the match limit instead of returning unbounded output", () => {
    writeFileSync(path.join(root, "src", "many.ts"), "needle\n".repeat(500));

    const { stdout } = search(["src/many.ts"], "needle");

    expect(stdout).toContain("stopped at the 200 match limit");
    expect(stdout.split("\n").filter((line) => line.startsWith("src/many.ts:"))).toHaveLength(200);
  });

  it("tolerates a Slice path that does not exist on disk", () => {
    const { stdout, status } = search(["src/absent.ts"], "value");

    expect(status).toBe(0);
    expect(stdout).toContain("no matches");
  });
});

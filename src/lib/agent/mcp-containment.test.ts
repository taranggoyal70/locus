import { execFileSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

// R5: the Locus MCP server is a local source-reading primitive. Its `locate`
// tool takes a directory and loadLocalRepo() returns the contents of every file
// beneath it, so a compromised editor, model, or plugin that can reach this
// server could otherwise read any directory the process can.
//
// These tests drive the real server over stdio, because the guarantee is about
// what the process does with hostile input, not about any single function.

const SERVER = path.resolve(process.cwd(), "bin/mcp.mjs");

let root: string;
let outside: string;

type Response = { id: number | null; result?: unknown; error?: { code: number; message: string } };

function call(requests: string[], options: { cwd?: string; roots?: string } = {}): Response[] {
  const stdout = execFileSync(process.execPath, [SERVER], {
    cwd: options.cwd ?? root,
    input: requests.join("\n") + "\n",
    encoding: "utf8",
    stdio: ["pipe", "pipe", "ignore"],
    env: options.roots
      ? { ...process.env, LOCUS_MCP_ROOTS: options.roots }
      : { ...process.env, LOCUS_MCP_ROOTS: "" },
  });
  return stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Response);
}

function locate(args: Record<string, unknown>, options?: { cwd?: string; roots?: string }) {
  const [response] = call(
    [JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "locate", arguments: args } })],
    options,
  );
  const result = response.result as { content: Array<{ text: string }>; isError?: boolean };
  return { text: result.content[0].text, isError: result.isError === true };
}

beforeAll(() => {
  root = realpathSync(mkdtempSync(path.join(tmpdir(), "locus-mcp-")));
  outside = realpathSync(mkdtempSync(path.join(tmpdir(), "locus-mcp-outside-")));
  writeFileSync(path.join(root, "index.ts"), "export const value = 1;\n");
  writeFileSync(path.join(outside, "secret.ts"), "export const apiKey = 'STOLEN';\n");
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(outside, { recursive: true, force: true });
});

describe("mcp root containment", () => {
  it("serves a directory inside the allowed root", () => {
    expect(locate({ task: "value", path: root }).isError).toBe(false);
  });

  it("defaults to the working directory when no path is supplied", () => {
    expect(locate({ task: "value" }).isError).toBe(false);
  });

  it("refuses a directory outside the allowed root", () => {
    const { text, isError } = locate({ task: "api key", path: outside });

    expect(isError).toBe(true);
    expect(text).toContain("outside the allowed Locus roots");
    // The point of the control: no file content escapes in the error path.
    expect(text).not.toContain("STOLEN");
  });

  it("refuses traversal out of the allowed root", () => {
    expect(locate({ task: "api key", path: `${root}/../` }).isError).toBe(true);
  });

  it("honours an explicit LOCUS_MCP_ROOTS allowlist", () => {
    expect(locate({ task: "api key", path: outside }, { roots: outside }).isError).toBe(false);
    expect(locate({ task: "value", path: root }, { roots: outside }).isError).toBe(true);
  });

  it("does not treat a sibling directory sharing a name prefix as contained", () => {
    // "/tmp/x" must not admit "/tmp/x-secrets"; the check requires a separator.
    const sibling = realpathSync(mkdtempSync(path.join(tmpdir(), "locus-mcp-sibling-")));
    try {
      expect(locate({ task: "value", path: sibling }, { roots: root }).isError).toBe(true);
    } finally {
      rmSync(sibling, { recursive: true, force: true });
    }
  });
});

describe("mcp stdio framing limits", () => {
  it("rejects a declared Content-Length above the message ceiling", () => {
    const stdout = execFileSync(process.execPath, [SERVER], {
      cwd: root,
      input: "Content-Length: 99999999\r\n\r\n",
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    });
    const response = JSON.parse(stdout.trim()) as Response;

    expect(response.id).toBeNull();
    expect(response.error?.code).toBe(-32600);
    expect(response.error?.message).toContain("exceeds the 4194304 byte limit");
  });

  it("rejects an unterminated line rather than buffering it without bound", () => {
    const stdout = execFileSync(process.execPath, [SERVER], {
      cwd: root,
      // No newline: the fallback framing would otherwise buffer this forever.
      input: "x".repeat(5 * 1024 * 1024),
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    });

    expect(stdout).toContain("-32600");
  });
});

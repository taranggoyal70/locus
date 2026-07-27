import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { RepoData } from "@/lib/types";

const root = process.cwd();
let fixtureRoot = "";

beforeAll(() => {
  const fixture: RepoData = JSON.parse(
    readFileSync(join(root, "test/fixtures/studentpulse.json"), "utf8"),
  );
  fixtureRoot = mkdtempSync(join(tmpdir(), "locus-runtime-"));

  for (const [relativePath, contents] of Object.entries(fixture.files)) {
    const destination = join(fixtureRoot, relativePath);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, contents);
  }
});

afterAll(() => {
  rmSync(fixtureRoot, { recursive: true, force: true });
});

describe("published runtime surfaces", () => {
  it("runs the CLI against a real directory and returns a focused JSON slice", () => {
    const output = execFileSync(
      process.execPath,
      [
        join(root, "bin/locus.mjs"),
        "locate",
        "fix date formatting timezone",
        "--path",
        fixtureRoot,
        "--json",
      ],
      { cwd: root, encoding: "utf8" },
    );
    const result = JSON.parse(output);

    expect(result.widened).toBe(false);
    expect(result.anchors).toContain("lib/date.ts");
    expect(result.slice.some((file: { rel: string }) => file.rel === "lib/date.ts")).toBe(true);
    expect(result.savedPct).toBeGreaterThan(0);
  });

  it("gives CLI users concrete refinement guidance after a safe Widen", () => {
    const output = execFileSync(
      process.execPath,
      [
        join(root, "bin/locus.mjs"),
        "locate",
        "make the checkout flow faster",
        "--path",
        fixtureRoot,
      ],
      { cwd: root, encoding: "utf8" },
    );

    expect(output).toContain("WIDENED to all loaded files");
    expect(output).toContain("Unmatched task terms: checkout, flow, faster");
    expect(output).toContain("Refine with a filename, symbol, or repo term:");
  });

  it("keeps packed context within a hard token budget", () => {
    const output = execFileSync(
      process.execPath,
      [
        join(root, "bin/locus.mjs"),
        "locate",
        "fix date formatting timezone",
        "--path",
        fixtureRoot,
        "--pack",
        "--budget",
        "1",
      ],
      { cwd: root, encoding: "utf8" },
    );

    expect(output).toContain("# 0 files, ~0 tokens");
    expect(output).toContain("file(s) omitted");
    expect(output).not.toContain("export function");
  });

  it("completes the MCP initialize, discovery, and locate call over stdio", () => {
    const requests = [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "locus-test", version: "1.0.0" },
        },
      },
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { jsonrpc: "2.0", id: 2, method: "tools/list" },
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "locate",
          arguments: {
            task: "fix date formatting timezone",
            path: fixtureRoot,
            pack: true,
            budget: 1,
          },
        },
      },
    ];
    const processResult = spawnSync(process.execPath, [join(root, "bin/mcp.mjs")], {
      cwd: root,
      encoding: "utf8",
      input: `${requests.map((request) => JSON.stringify(request)).join("\n")}\n`,
    });

    expect(processResult.status).toBe(0);
    const responses = processResult.stdout
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));

    expect(responses).toHaveLength(3);
    expect(responses[0].result.serverInfo).toEqual({ name: "locus", version: "0.2.0" });
    expect(responses[1].result.tools.map((tool: { name: string }) => tool.name)).toContain("locate");
    expect(responses[2].result.content[0].text).toContain("lib/date.ts");
    expect(responses[2].result.content[0].text).toContain("# 0 files, ~0 tokens");
    expect(responses[2].result.isError).not.toBe(true);
  });

  it("reports the package version from the published CLI layout", () => {
    const request = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "locus-test", version: "1.0.0" },
      },
    };
    const processResult = spawnSync(process.execPath, [join(root, "cli/mcp.mjs")], {
      cwd: root,
      encoding: "utf8",
      input: `${JSON.stringify(request)}\n`,
    });

    expect(processResult.status).toBe(0);
    const response = JSON.parse(processResult.stdout.trim());
    expect(response.result.serverInfo).toEqual({ name: "locus", version: "0.2.0" });
  });
});

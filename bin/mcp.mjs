#!/usr/bin/env node
// Locus MCP server — JSON-RPC 2.0 over stdio, newline-delimited JSON (MCP stdio spec) — the
// framing MCP clients use). No SDK dependency: hand-rolled framing + dispatch.
// stdout carries ONLY JSON-RPC; all logging goes to stderr.
import path from "node:path";
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildGraph, locate, loadLocalRepo, formatResult, buildPackedContext } from "./core.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

// --- R5: containment for a local source-reading primitive ---
//
// locate() accepts a directory and loadLocalRepo() returns the contents of
// every file beneath it. Without a server-enforced allowlist, any client that
// can invoke this server — a compromised editor, model, or plugin — can read
// any directory this process can reach. MCP "roots" are advertised by the
// client and enforce nothing; the server stays responsible for its own limits.
//
// Default: the working directory the server was started in, matching prior
// behaviour. Override with LOCUS_MCP_ROOTS (platform path-delimited).
function resolveAllowedRoots() {
  const configured = process.env.LOCUS_MCP_ROOTS;
  const candidates = configured
    ? configured.split(path.delimiter).map((entry) => entry.trim()).filter(Boolean)
    : [process.cwd()];
  const roots = [];
  for (const candidate of candidates) {
    try {
      // realpath so a symlinked root cannot widen the allowlist later.
      roots.push(realpathSync(path.resolve(candidate)));
    } catch {
      log(`ignoring unreadable root: ${candidate}`);
    }
  }
  if (roots.length === 0) {
    throw new Error("No readable Locus MCP root; set LOCUS_MCP_ROOTS to an existing directory");
  }
  return roots;
}

function containRequestedPath(input) {
  let resolved;
  try {
    resolved = realpathSync(path.resolve(String(input)));
  } catch {
    throw new Error(`path does not exist or is not readable: ${input}`);
  }
  // Compare canonical paths, and require a separator so that a sibling root
  // such as "/repo-secrets" cannot match the allowed root "/repo".
  const allowed = ALLOWED_ROOTS.some(
    (root) => resolved === root || resolved.startsWith(root + path.sep),
  );
  if (!allowed) {
    throw new Error(`path is outside the allowed Locus roots: ${ALLOWED_ROOTS.join(", ")}`);
  }
  return resolved;
}

// --- R5: bounded stdio framing ---
// Hand-rolled framing with no ceiling lets a local client exhaust memory by
// declaring a huge Content-Length or never sending a newline.
const MAX_MESSAGE_BYTES = 4 * 1024 * 1024;
const MAX_BUFFER_BYTES = 8 * 1024 * 1024;

function pkgVersion() {
  try {
    const pkg = JSON.parse(readFileSync(path.join(here, "..", "package.json"), "utf8"));
    return pkg.version || "0.1.0";
  } catch {
    return "0.1.0";
  }
}
const VERSION = pkgVersion();

function log(...a) {
  console.error("[locus-mcp]", ...a);
}

const ALLOWED_ROOTS = resolveAllowedRoots();

function send(obj) {
  // MCP stdio transport is newline-delimited JSON (one message per line),
  // NOT LSP-style Content-Length framing. JSON.stringify never emits a raw
  // newline, so a single trailing "\n" is a safe message delimiter.
  process.stdout.write(JSON.stringify(obj) + "\n");
}

const TOOLS = [
  {
    name: "locate",
    description:
      "Localize a task to a focused TypeScript code slice using path/source evidence, dependency closure, integration points, and recent changes. Falls back to the whole repo when evidence is weak.",
    inputSchema: {
      type: "object",
      properties: {
        task: {
          type: "string",
          description: "The task, bug report, or feature description to localize.",
        },
        path: {
          type: "string",
          description: "Repo directory to analyze. Defaults to the server process's cwd.",
        },
        evidence: {
          type: "string",
          description: "Additional context (error messages, stack traces) to improve file matching.",
        },
        pack: {
          type: "boolean",
          description: "If true, also include a ready-to-paste packed context block of the slice's file contents.",
        },
      },
      required: ["task"],
    },
  },
];

function runLocate(args) {
  const task = args && args.task;
  if (!task || typeof task !== "string" || !task.trim()) {
    throw new Error("task (non-empty string) is required");
  }
  const dir = args.path ? containRequestedPath(args.path) : ALLOWED_ROOTS[0];
  const evidence = typeof args.evidence === "string" ? args.evidence : "";
  const pack = !!args.pack;
  const repo = loadLocalRepo(dir);
  const graph = buildGraph(repo);
  const result = locate(task, repo, graph, evidence);
  let text = formatResult(result, repo);
  if (pack) {
    const packed = buildPackedContext(result, repo, 40000);
    text += `\n\n${packed.text}`;
  }
  return text;
}

async function handleMessage(raw) {
  let msg;
  try {
    msg = JSON.parse(raw);
  } catch (e) {
    log("bad JSON-RPC message:", e.message);
    return;
  }
  const { id, method, params } = msg;
  const hasId = id !== undefined && id !== null;
  try {
    if (method === "initialize") {
      send({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "locus", version: VERSION },
        },
      });
    } else if (method === "notifications/initialized") {
      // no-op notification
    } else if (method === "tools/list") {
      send({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
    } else if (method === "tools/call") {
      const name = params && params.name;
      const callArgs = (params && params.arguments) || {};
      if (name !== "locate") {
        send({ jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown tool: ${name}` } });
        return;
      }
      try {
        const text = runLocate(callArgs);
        send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text }] } });
      } catch (err) {
        send({
          jsonrpc: "2.0",
          id,
          result: { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true },
        });
      }
    } else if (hasId) {
      send({ jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } });
    } else {
      log("unhandled notification:", method);
    }
  } catch (err) {
    if (hasId) {
      send({ jsonrpc: "2.0", id, error: { code: -32603, message: String((err && err.message) || err) } });
    }
    log("handler error:", err && err.stack ? err.stack : err);
  }
}

// --- stdio framing: Content-Length framed (primary) with a line-delimited
// JSON fallback for simpler clients/tests. ---
let buf = Buffer.alloc(0);

// Protocol-level failures happen before any id is parsed, so they are reported
// against a null id per JSON-RPC 2.0.
function sendProtocolError(message) {
  send({ jsonrpc: "2.0", id: null, error: { code: -32600, message } });
}

// Dropping the buffer on overflow is deliberate: the stream is mid-message and
// no longer parseable, so continuing would splice attacker-chosen bytes into
// whatever arrives next.
function resetBuffer(reason) {
  log(reason);
  buf = Buffer.alloc(0);
  sendProtocolError(reason);
}

process.stdin.on("data", (chunk) => {
  if (buf.length + chunk.length > MAX_BUFFER_BYTES) {
    resetBuffer(`input exceeded ${MAX_BUFFER_BYTES} bytes without a complete message`);
    return;
  }
  buf = Buffer.concat([buf, chunk]);
  drain();
});
process.stdin.on("end", () => process.exit(0));

function drain() {
  while (true) {
    const headerEnd = buf.indexOf("\r\n\r\n");
    if (headerEnd !== -1 && /content-length/i.test(buf.toString("utf8", 0, headerEnd))) {
      const header = buf.toString("utf8", 0, headerEnd);
      const m = /content-length:\s*(\d+)/i.exec(header);
      if (!m) {
        buf = buf.slice(headerEnd + 4);
        continue;
      }
      const len = Number.parseInt(m[1], 10);
      // The declared length is attacker-controlled and is trusted for the
      // buffering decision below, so it has to be bounded before we wait on it.
      if (!Number.isSafeInteger(len) || len < 0 || len > MAX_MESSAGE_BYTES) {
        resetBuffer(`declared Content-Length ${m[1]} exceeds the ${MAX_MESSAGE_BYTES} byte limit`);
        return;
      }
      const bodyStart = headerEnd + 4;
      if (buf.length < bodyStart + len) return; // wait for more bytes
      const body = buf.toString("utf8", bodyStart, bodyStart + len);
      buf = buf.slice(bodyStart + len);
      handleMessage(body);
      continue;
    }
    // Fallback: line-delimited JSON.
    const nl = buf.indexOf("\n");
    if (nl === -1) {
      // No delimiter yet. A client that never sends one would otherwise buffer
      // without bound; the data handler caps total growth, but a single
      // oversized line is rejected here so the limit is per-message too.
      if (buf.length > MAX_MESSAGE_BYTES) {
        resetBuffer(`line exceeded the ${MAX_MESSAGE_BYTES} byte message limit`);
      }
      return;
    }
    const line = buf.toString("utf8", 0, nl).trim();
    buf = buf.slice(nl + 1);
    if (line) handleMessage(line);
  }
}

log(`locus mcp server ready (v${VERSION})`);

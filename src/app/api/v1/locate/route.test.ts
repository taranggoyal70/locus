import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authenticateApiKeyMock = vi.hoisted(() => vi.fn());
const consumeRateLimitMock = vi.hoisted(() => vi.fn());
const trackMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-auth", () => ({ authenticateApiKey: authenticateApiKeyMock }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: consumeRateLimitMock }));
vi.mock("@/lib/analytics", () => ({ track: trackMock }));

import {
  DEFAULT_CONTEXT_BUDGET_TOKENS,
  MAX_CONTEXT_BUDGET_TOKENS,
  OPTIONS,
  POST,
  resolveContextBudget,
} from "@/app/api/v1/locate/route";

function request() {
  return new Request("https://locus.example/api/v1/locate", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer lk_test" },
    body: JSON.stringify({ repo: "owner/repo", task: "Fix the checkout path" }),
  });
}

describe("locate API throttling", () => {
  beforeEach(() => {
    authenticateApiKeyMock.mockResolvedValue({ userId: "user_123", keyId: "key_123" });
    consumeRateLimitMock.mockReset();
    trackMock.mockReset();
  });

  it("enforces a durable per-user API limit", async () => {
    consumeRateLimitMock.mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterSeconds: 18 });

    const response = await POST(request());

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("18");
    expect(consumeRateLimitMock).toHaveBeenCalledWith({
      namespace: "api-locate",
      identity: "user_123",
      limit: 30,
      windowSeconds: 60,
    });
  });
});

describe("locate API analytics", () => {
  afterEach(() => vi.unstubAllGlobals());

  beforeEach(() => {
    authenticateApiKeyMock.mockResolvedValue({ userId: "user_123", keyId: "key_123" });
    consumeRateLimitMock.mockResolvedValue({ allowed: true, remaining: 29, retryAfterSeconds: 0 });
    trackMock.mockReset();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "https://api.github.com/repos/owner/repo") {
        return Response.json({ default_branch: "main" });
      }
      if (url === "https://api.github.com/repos/owner/repo/git/trees/main?recursive=1") {
        return Response.json({
          sha: "commit-sha",
          tree: [
            { path: "src/checkout.ts", type: "blob", size: 78 },
          ],
        });
      }
      if (url === "https://raw.githubusercontent.com/owner/repo/commit-sha/src/checkout.ts") {
        return new Response("export function checkoutTotal() { return 42; }\n");
      }
      return new Response("not found", { status: 404 });
    }));
  });

  it("records only the task shape for successful locate requests", async () => {
    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    // The repo is rooted at `src`, so the source-root-relative spelling
    // ("checkout.ts") names no file in the repository. Every path the response
    // and the packed block name has to be the repo-relative one a caller can
    // open in a checkout.
    expect(body.slice).toEqual([
      expect.objectContaining({ path: "src/checkout.ts" }),
    ]);
    expect(body.anchors).toEqual(["src/checkout.ts"]);
    expect(body.context).toContain("===== src/checkout.ts =====");
    expect(body.context).toContain("# warning: few internal imports resolved (0.00 edges/file)");
    expect(body.context.indexOf("# warning:")).toBeLessThan(body.context.indexOf("===== src/checkout.ts ====="));
    expect(trackMock).toHaveBeenCalledWith({
      event: "api_locate",
      userId: "user_123",
      properties: expect.objectContaining({
        repo: "owner/repo",
        taskShape: expect.stringMatching(/^[a-f0-9]{16}$/),
        taskCharacters: "Fix the checkout path".length,
      }),
    });
    expect(trackMock.mock.calls[0][0].properties).not.toHaveProperty("task");
  });
});

// R12: CORS is only consulted by browsers, so tightening it costs the CLI, the
// MCP server, and server-side callers nothing. The wildcard let any page that
// had obtained a key drive the authenticated API.
describe("locate API cross-origin policy", () => {
  beforeEach(() => {
    authenticateApiKeyMock.mockResolvedValue({ userId: "user_123", keyId: "key_123" });
    consumeRateLimitMock.mockReset();
    delete process.env.LOCUS_API_ALLOWED_ORIGINS;
  });

  function preflight(origin?: string) {
    return new Request("https://locus.example/api/v1/locate", {
      method: "OPTIONS",
      headers: origin ? { origin } : {},
    });
  }

  it("does not advertise a wildcard origin", () => {
    const response = OPTIONS(preflight("https://evil.example"));

    expect(response.headers.get("access-control-allow-origin")).not.toBe("*");
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("echoes only an explicitly allowlisted origin", () => {
    process.env.LOCUS_API_ALLOWED_ORIGINS = "https://app.example, https://studio.example";

    expect(
      OPTIONS(preflight("https://app.example")).headers.get("access-control-allow-origin"),
    ).toBe("https://app.example");
    expect(
      OPTIONS(preflight("https://evil.example")).headers.get("access-control-allow-origin"),
    ).toBeNull();
  });

  it("varies on origin so a cache cannot share one origin's response", () => {
    expect(OPTIONS(preflight("https://app.example")).headers.get("vary")).toBe("Origin");
  });

  it("still answers a preflight that carries no origin", () => {
    expect(OPTIONS(preflight()).status).toBe(204);
  });
});

// R12: the caller-supplied budget had no ceiling. "budget": 1e400 becomes
// Infinity, which packed the entire repository into a single response.
describe("locate API context budget", () => {
  it("keeps the previous default when no budget is supplied", () => {
    expect(resolveContextBudget(undefined)).toBe(DEFAULT_CONTEXT_BUDGET_TOKENS);
  });

  it("honours a reasonable caller budget", () => {
    expect(resolveContextBudget(12_000)).toBe(12_000);
  });

  it.each([Number.MAX_VALUE, 10_000_000, 200_001])(
    "clamps a finite but oversized budget to the ceiling: %s",
    (value) => {
      expect(resolveContextBudget(value)).toBe(MAX_CONTEXT_BUDGET_TOKENS);
    },
  );

  // A non-finite budget is not a large request, it is a nonsense one, so it
  // falls back to the default rather than being granted the ceiling.
  it.each([1e400, "1e400", Number.POSITIVE_INFINITY])(
    "refuses to grant the ceiling to a non-finite budget: %s",
    (value) => {
      expect(resolveContextBudget(value)).toBe(DEFAULT_CONTEXT_BUDGET_TOKENS);
    },
  );

  it.each([0, -1, Number.NaN, "abc", null, {}])(
    "falls back to the default for a non-positive or unparseable budget: %s",
    (value) => {
      expect(resolveContextBudget(value)).toBe(DEFAULT_CONTEXT_BUDGET_TOKENS);
    },
  );
});

// The route reads every repository with the server's GITHUB_TOKEN, so whether a
// private repository is reachable depends entirely on that token's scope rather
// than on anything the caller proved. `/api/github` refuses non-public repos
// explicitly; this route must too, or the day the token gains `repo` scope it
// becomes a cross-tenant source-disclosure path.
describe("locate API repository visibility", () => {
  afterEach(() => vi.unstubAllGlobals());

  beforeEach(() => {
    authenticateApiKeyMock.mockResolvedValue({ userId: "user_123", keyId: "key_123" });
    consumeRateLimitMock.mockResolvedValue({ allowed: true, remaining: 29, retryAfterSeconds: 0 });
    trackMock.mockReset();
  });

  function stubGitHub(meta: Record<string, unknown>) {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "https://api.github.com/repos/owner/repo") return Response.json(meta);
      if (url === "https://api.github.com/repos/owner/repo/git/trees/main?recursive=1") {
        return Response.json({ sha: "commit-sha", tree: [{ path: "src/secret.ts", type: "blob", size: 40 }] });
      }
      if (url === "https://raw.githubusercontent.com/owner/repo/commit-sha/src/secret.ts") {
        return new Response("export const apiKey = 'sk-live';\n");
      }
      return new Response("not found", { status: 404 });
    }));
  }

  it("refuses a repository marked private", async () => {
    stubGitHub({ default_branch: "main", private: true });

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(JSON.stringify(body)).not.toContain("sk-live");
  });

  it("refuses a repository whose visibility is not public", async () => {
    stubGitHub({ default_branch: "main", private: false, visibility: "internal" });

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(JSON.stringify(body)).not.toContain("sk-live");
  });

  it("still serves a public repository", async () => {
    stubGitHub({ default_branch: "main", private: false, visibility: "public" });

    const response = await POST(request());

    expect(response.status).toBe(200);
  });
});

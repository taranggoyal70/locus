import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateApiKeyMock = vi.hoisted(() => vi.fn());
const consumeRateLimitMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-auth", () => ({ authenticateApiKey: authenticateApiKeyMock }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: consumeRateLimitMock }));

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

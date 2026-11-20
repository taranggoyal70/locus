import { beforeEach, describe, expect, it, vi } from "vitest";

import { setupTestDatabase } from "@/test/database";

const consumeRateLimitMock = vi.hoisted(() => vi.fn());
const trackMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: consumeRateLimitMock }));
vi.mock("@/lib/analytics", () => ({ track: trackMock }));

import { POST } from "@/app/api/waitlist/route";

const database = setupTestDatabase();

function request(headers: Record<string, string> = {}) {
  return new Request("https://locus.example/api/waitlist", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10", origin: "https://locus.example", ...headers },
    body: JSON.stringify({ email: "Founder@Example.com", company: "Acme" }),
  });
}

async function waitlist() {
  return database().selectFrom("waitlist").select(["email", "company"]).execute();
}

describe("waitlist request protection", () => {
  beforeEach(() => {
    consumeRateLimitMock.mockReset();
    trackMock.mockReset();
  });

  it("rejects cross-origin browser submissions before database access", async () => {
    const response = await POST(request({ origin: "https://attacker.example" }));

    expect(response.status).toBe(403);
    expect(consumeRateLimitMock).not.toHaveBeenCalled();
    expect(await waitlist()).toEqual([]);
  });

  it("enforces the durable submission limit", async () => {
    consumeRateLimitMock.mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterSeconds: 900 });

    const response = await POST(request());

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("900");
    expect(await waitlist()).toEqual([]);
  });

  it("records an anonymous conversion without retaining form content in analytics", async () => {
    consumeRateLimitMock.mockResolvedValue({ allowed: true, remaining: 4, retryAfterSeconds: 0 });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(await waitlist()).toEqual([{ email: "founder@example.com", company: "Acme" }]);
    expect(trackMock).toHaveBeenCalledWith({
      event: "alpha_access_requested",
      properties: { result: "new" },
    });
  });

  it("answers a repeat signup as already listed rather than as an error", async () => {
    consumeRateLimitMock.mockResolvedValue({ allowed: true, remaining: 4, retryAfterSeconds: 0 });
    await POST(request());

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, message: "You're already on the waitlist." });
    expect(await waitlist()).toHaveLength(1);
    expect(trackMock).toHaveBeenLastCalledWith({
      event: "alpha_access_requested",
      properties: { result: "existing" },
    });
  });
});

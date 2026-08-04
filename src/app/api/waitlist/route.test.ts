import { beforeEach, describe, expect, it, vi } from "vitest";

const consumeRateLimitMock = vi.hoisted(() => vi.fn());
const serviceClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: consumeRateLimitMock }));
vi.mock("@/lib/supabase", () => ({ serviceClient: serviceClientMock }));

import { POST } from "@/app/api/waitlist/route";

function request(headers: Record<string, string> = {}) {
  return new Request("https://locus.example/api/waitlist", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.10", origin: "https://locus.example", ...headers },
    body: JSON.stringify({ email: "founder@example.com" }),
  });
}

describe("waitlist request protection", () => {
  beforeEach(() => {
    consumeRateLimitMock.mockReset();
    serviceClientMock.mockReset();
  });

  it("rejects cross-origin browser submissions before database access", async () => {
    const response = await POST(request({ origin: "https://attacker.example" }));

    expect(response.status).toBe(403);
    expect(serviceClientMock).not.toHaveBeenCalled();
  });

  it("enforces the durable submission limit", async () => {
    consumeRateLimitMock.mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterSeconds: 900 });

    const response = await POST(request());

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("900");
    expect(serviceClientMock).not.toHaveBeenCalled();
  });
});

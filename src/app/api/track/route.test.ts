import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const consumeRateLimitMock = vi.hoisted(() => vi.fn());

vi.mock("@clerk/nextjs/server", () => ({ auth: authMock }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: consumeRateLimitMock }));

import { POST } from "@/app/api/track/route";

function request(headers: Record<string, string> = {}) {
  return new Request("https://locus.example/api/track", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ event: "context_copied" }),
  });
}

describe("analytics mutation protection", () => {
  beforeEach(() => {
    authMock.mockResolvedValue({ userId: "user_123" });
    consumeRateLimitMock.mockReset();
  });

  it("rejects a cross-origin browser write", async () => {
    const response = await POST(request({ origin: "https://attacker.example" }));

    expect(response.status).toBe(403);
  });

  it("enforces the durable analytics limit", async () => {
    consumeRateLimitMock.mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterSeconds: 12 });

    const response = await POST(request());

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("12");
  });
});

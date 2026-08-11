import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const consumeRateLimitMock = vi.hoisted(() => vi.fn());
const trackMock = vi.hoisted(() => vi.fn());

vi.mock("@clerk/nextjs/server", () => ({ auth: authMock }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: consumeRateLimitMock }));
vi.mock("@/lib/analytics", () => ({ track: trackMock }));

import { POST } from "@/app/api/track/route";

function request(headers: Record<string, string> = {}, body?: unknown) {
  return new Request("https://locus.example/api/track", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://locus.example", ...headers },
    body: JSON.stringify(body ?? { event: "context_copied" }),
  });
}

describe("analytics mutation protection", () => {
  beforeEach(() => {
    authMock.mockResolvedValue({ userId: "user_123" });
    consumeRateLimitMock.mockReset();
    trackMock.mockReset();
  });

  it("persists only the declared properties for the event", async () => {
    consumeRateLimitMock.mockResolvedValue({ allowed: true, remaining: 119, retryAfterSeconds: 0 });

    const response = await POST(
      request({}, {
        event: "context_copied",
        properties: { format: "claude", files: 8, task: "rename the acme billing column" },
      }),
    );

    expect(response.status).toBe(200);
    expect(trackMock).toHaveBeenCalledWith({
      event: "context_copied",
      userId: "user_123",
      properties: { format: "claude", files: 8 },
    });
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

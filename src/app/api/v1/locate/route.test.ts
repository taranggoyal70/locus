import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticateApiKeyMock = vi.hoisted(() => vi.fn());
const consumeRateLimitMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-auth", () => ({ authenticateApiKey: authenticateApiKeyMock }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: consumeRateLimitMock }));

import { POST } from "@/app/api/v1/locate/route";

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

import { describe, expect, it, vi } from "vitest";

import { consumeRateLimit } from "@/lib/rate-limit";

describe("durable API rate limits", () => {
  it("hashes identities and returns the database decision", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ allowed: true, remaining: 2, retry_after_seconds: 0 }],
      error: null,
    });

    const decision = await consumeRateLimit(
      { namespace: "agent-start", identity: "user_secret", limit: 3, windowSeconds: 60 },
      { rpc } as never,
    );

    expect(decision).toEqual({ allowed: true, remaining: 2, retryAfterSeconds: 0 });
    expect(rpc).toHaveBeenCalledOnce();
    const [, args] = rpc.mock.calls[0];
    expect(args).toMatchObject({ p_limit: 3, p_window_seconds: 60 });
    expect(args.p_bucket).toMatch(/^agent-start:[a-f0-9]{64}$/);
    expect(args.p_bucket).not.toContain("user_secret");
  });

  it("fails closed when the limiter cannot verify a decision", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "offline" } });

    await expect(consumeRateLimit(
      { namespace: "waitlist", identity: "203.0.113.1", limit: 5, windowSeconds: 60 },
      { rpc } as never,
    )).rejects.toThrow("Rate limit could not be verified");
  });
});

import { sql } from "kysely";
import { describe, expect, it } from "vitest";

import { consumeRateLimit } from "@/lib/rate-limit";
import { setupTestDatabase } from "@/test/database";

const database = setupTestDatabase();

describe("durable API rate limits", () => {
  it("allows up to the limit, then refuses with a retry window", async () => {
    const input = { namespace: "agent-start", identity: "user_secret", limit: 2, windowSeconds: 60 };

    expect(await consumeRateLimit(input)).toMatchObject({ allowed: true, remaining: 1 });
    expect(await consumeRateLimit(input)).toMatchObject({ allowed: true, remaining: 0 });
    const refused = await consumeRateLimit(input);
    expect(refused.allowed).toBe(false);
    expect(refused.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("keys buckets by a hash, so the stored bucket never contains the identity", async () => {
    await consumeRateLimit({ namespace: "agent-start", identity: "user_secret", limit: 3, windowSeconds: 60 });

    const rows = await sql<{ bucket: string }>`select bucket from public.api_rate_limits`.execute(database());
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].bucket).toMatch(/^agent-start:[a-f0-9]{64}$/);
    expect(rows.rows[0].bucket).not.toContain("user_secret");
  });

  it("counts each identity separately", async () => {
    const limit = { namespace: "waitlist", limit: 1, windowSeconds: 60 };

    expect((await consumeRateLimit({ ...limit, identity: "203.0.113.1" })).allowed).toBe(true);
    expect((await consumeRateLimit({ ...limit, identity: "203.0.113.2" })).allowed).toBe(true);
    expect((await consumeRateLimit({ ...limit, identity: "203.0.113.1" })).allowed).toBe(false);
  });

  it("fails closed when the limiter cannot verify a decision", async () => {
    await sql`drop function public.consume_api_rate_limit(text, integer, integer)`.execute(database());

    await expect(consumeRateLimit(
      { namespace: "waitlist", identity: "203.0.113.1", limit: 5, windowSeconds: 60 },
    )).rejects.toThrow("Rate limit could not be verified");
  });
});

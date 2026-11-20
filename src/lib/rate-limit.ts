import type { Kysely } from "kysely";

import { globalDb, rpc, type Database } from "@/lib/db";

type RateLimitInput = {
  namespace: string;
  identity: string;
  limit: number;
  windowSeconds: number;
};

export type RateLimitDecision = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function consumeRateLimit(
  input: RateLimitInput,
  database?: Kysely<Database>,
): Promise<RateLimitDecision> {
  const identityHash = await sha256(input.identity);
  let rows: Awaited<ReturnType<typeof rpc<"consume_api_rate_limit">>>;
  try {
    // A bucket is keyed by a hash of the caller, not by an account, so it spans
    // tenants by design.
    rows = await rpc(database ?? globalDb("rate limit buckets are keyed by caller hash"), "consume_api_rate_limit", {
      p_bucket: `${input.namespace}:${identityHash}`,
      p_limit: input.limit,
      p_window_seconds: input.windowSeconds,
    });
  } catch (error) {
    throw new Error("Rate limit could not be verified", { cause: error });
  }
  const row = rows[0];
  if (!row || row.allowed === null || row.remaining === null || row.retry_after_seconds === null) {
    throw new Error("Rate limit could not be verified");
  }

  return {
    allowed: row.allowed,
    remaining: row.remaining,
    retryAfterSeconds: row.retry_after_seconds,
  };
}

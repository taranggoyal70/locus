import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { serviceClient } from "@/lib/supabase";

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
  db: Pick<SupabaseClient<Database>, "rpc"> = serviceClient(),
): Promise<RateLimitDecision> {
  const identityHash = await sha256(input.identity);
  const { data, error } = await db.rpc("consume_api_rate_limit", {
    p_bucket: `${input.namespace}:${identityHash}`,
    p_limit: input.limit,
    p_window_seconds: input.windowSeconds,
  });
  const row = data?.[0];
  if (error || !row) throw new Error("Rate limit could not be verified");

  return {
    allowed: row.allowed,
    remaining: row.remaining,
    retryAfterSeconds: row.retry_after_seconds,
  };
}

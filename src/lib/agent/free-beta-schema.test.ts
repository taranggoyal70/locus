import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../../supabase/migrations/020_free_public_beta.sql", import.meta.url),
  "utf8",
);

describe("free public beta migration", () => {
  it("freezes provider mode and stores user credentials behind the service role", () => {
    expect(migration).toContain("add column provider text");
    expect(migration).toContain("add column execution_mode text");
    expect(migration).toContain("create table public.agent_provider_credentials");
    expect(migration).toContain("encrypted_api_token text not null");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("revoke all on table public.agent_provider_credentials");
  });

  it("claims the recurring shared allowance atomically per UTC day", () => {
    expect(migration).toContain("create table public.agent_provider_daily_claims");
    expect(migration).toContain("function public.claim_agent_provider_daily_slot");
    expect(migration).toContain("date_trunc('day', v_now at time zone 'UTC')");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("grant execute on function public.claim_agent_provider_daily_slot");
  });
});

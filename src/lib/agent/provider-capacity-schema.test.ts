import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../../supabase/migrations/013_agent_provider_capacity.sql", import.meta.url),
  "utf8",
).toLowerCase();

describe("Agent provider capacity migration", () => {
  it("serializes provider reservations and leaves a cooldown after release", () => {
    expect(migration).toContain("create table public.agent_provider_leases");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("function public.acquire_agent_provider_lease");
    expect(migration).toContain("function public.release_agent_provider_lease");
    expect(migration).toContain("make_interval(secs => p_cooldown_seconds)");
  });

  it("keeps lease coordination service-role only", () => {
    expect(migration.match(/security definer/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");
  });
});

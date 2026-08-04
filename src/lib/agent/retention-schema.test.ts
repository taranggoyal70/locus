import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../../supabase/migrations/014_agent_data_retention.sql", import.meta.url),
  "utf8",
).toLowerCase();

describe("Agent data retention migration", () => {
  it("deletes only terminal Runs beyond the configured retention boundary", () => {
    expect(migration).toContain("function public.delete_expired_agent_data");
    expect(migration).toContain("p_retention_days integer default 30");
    expect(migration).toContain("status in ('completed', 'rejected', 'failed', 'cancelled')");
    expect(migration).toContain("completed_at < v_cutoff");
    expect(migration).toContain("set_config('locus.retention_delete', 'on', true)");
  });

  it("keeps cleanup service-role only", () => {
    expect(migration).toContain("security definer");
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");
  });
});

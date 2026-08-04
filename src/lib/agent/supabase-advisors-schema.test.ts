import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../../supabase/migrations/015_supabase_advisor_hardening.sql", import.meta.url),
  "utf8",
).toLowerCase();

describe("Supabase advisor hardening migration", () => {
  it("pins the shared trigger function search path", () => {
    expect(migration).toContain(
      "alter function public.update_updated_at() set search_path = ''",
    );
  });

  it("evaluates the request identity once per RLS statement", () => {
    expect(migration.match(/\(select current_setting\('app\.user_id', true\)\)/g)).toHaveLength(3);
    expect(migration).toContain('policy "users own projects"');
    expect(migration).toContain('policy "users own api_keys"');
    expect(migration).toContain('policy "users own subscriptions"');
  });
});

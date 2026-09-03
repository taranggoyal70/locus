import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { ADMISSION_TIERS } from "@/lib/admission";

const migration = readFileSync(
  new URL("../../supabase/migrations/018_account_admissions.sql", import.meta.url),
  "utf8",
).toLowerCase();

describe("Account admissions migration", () => {
  it("stores every Tier the application can resolve", () => {
    // The check constraint and ADMISSION_TIERS are two spellings of the same
    // list. If a tier is added in TypeScript and not here, the first operator
    // grant at that tier fails on a constraint violation in production rather
    // than in CI.
    const constraint = migration.match(/check \(tier in \(([^)]*)\)\)/)?.[1];
    expect(constraint).toBeDefined();
    const allowed = constraint!
      .split(",")
      .map((value) => value.trim().replaceAll("'", ""));
    expect(allowed.sort()).toEqual([...ADMISSION_TIERS].sort());
  });

  it("records the provenance of every grant", () => {
    expect(migration).toContain("source text not null");
    expect(migration).toContain("check (source in ('self_serve', 'operator', 'subscription'))");
    expect(migration).toContain("granted_at timestamptz not null default now()");
  });

  it("keeps the table service-role only", () => {
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("revoke all on table public.account_admissions from public, anon, authenticated");
    expect(migration).toContain("to service_role");
  });

  it("bounds the operator note so the table cannot be used as free storage", () => {
    expect(migration).toContain("length(note) <= 500");
  });

  it("keeps updated_at maintained by the shared trigger", () => {
    expect(migration).toContain("create trigger account_admissions_updated_at");
    expect(migration).toContain("execute function public.update_updated_at()");
  });
});

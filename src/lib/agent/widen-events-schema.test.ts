import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../../supabase/migrations/021_agent_widen_events.sql", import.meta.url),
  "utf8",
).toLowerCase();

describe("Agent widen event migration", () => {
  it("records both outcomes, so a refusal is evidence rather than a thrown error", () => {
    expect(migration).toContain("create table public.agent_widen_events");
    expect(migration).toContain("outcome in ('granted', 'refused')");
    for (const cause of [
      "missing_reason",
      "not_excluded",
      "sensitive_path",
      "limit_exceeded",
      "invalid_path",
    ]) {
      expect(migration, cause).toContain(cause);
    }
  });

  it("keeps the attempt order, which is what makes a probing pattern legible", () => {
    expect(migration).toContain("sequence integer not null check (sequence >= 1)");
    expect(migration).toContain("unique (run_id, sequence)");
  });

  // An outcome the trail cannot explain is worse than no trail: it reads as
  // authoritative while omitting why.
  it("refuses to store an outcome without its cause", () => {
    expect(migration).toContain("outcome = 'granted' and refusal is null");
    expect(migration).toContain("outcome = 'refused' and refusal is not null");
  });

  it("does not constrain path to a valid repo path", () => {
    // An invalid_path refusal stores the raw input the Agent asked for. A repo
    // path constraint here would reject exactly the row worth keeping.
    expect(migration).toContain("path text not null check (length(path) between 1 and 1000)");
  });

  it("is immutable evidence, like reviews and published artifacts", () => {
    expect(migration).toContain("alter table public.agent_widen_events enable row level security");
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");
    expect(migration).toContain("trigger immutable_agent_widen_events");
    expect(migration).toContain("execute function public.prevent_agent_evidence_mutation()");
  });

  it("indexes the cross-run question it exists to answer", () => {
    expect(migration).toContain("where outcome = 'refused'");
  });
});

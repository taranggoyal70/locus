import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../../supabase/migrations/012_release1_run_evidence.sql", import.meta.url),
  "utf8",
).toLowerCase();

describe("Release 1 Run evidence migration", () => {
  it("records bounded failures and artifact-bound human decisions", () => {
    expect(migration).toContain("token_budget");
    expect(migration).toContain("failure_kind");
    expect(migration).toContain("proposal_hash");
    expect(migration).toContain("create table public.agent_reviews");
    expect(migration).toContain("criterion_decisions");
  });

  it("publishes proposal artifacts and review readiness in one locked transaction", () => {
    expect(migration).toContain("function public.publish_agent_proposal");
    expect(migration).toContain("for update");
    expect(migration).toContain("v_status <> 'executing'");
    expect(migration).toContain("status = 'awaiting_approval'");
    expect(migration).toContain("jsonb_array_length(p_verify_detail -> 'checks')");
    expect(migration).toContain("p_input_tokens + p_output_tokens > v_token_budget");
  });

  it("binds a review to the exact proposal and prevents evidence rewriting", () => {
    expect(migration).toContain("function public.decide_agent_proposal");
    expect(migration).toContain("p_proposal_hash <> v_proposal_hash");
    expect(migration).toContain("prevent_agent_evidence_mutation");
    expect(migration).toContain("before update or delete");
    expect(migration).toContain("p_verify_detail::text");
    expect(migration).toContain("decision = 'accepted'");
  });

  it("keeps privileged functions and evidence tables inaccessible to browser roles", () => {
    expect(migration.match(/security definer/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migration.match(/set search_path = ''/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");
  });
});

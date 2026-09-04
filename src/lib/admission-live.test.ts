import { beforeAll, describe, expect, it } from "vitest";

import { admissionWithCapabilities } from "@/lib/admission";
import {
  admitSelfServe,
  countSelfServeAdmissions,
  hasActiveSubscription,
  readStoredAdmission,
} from "@/lib/admission-store";

/**
 * The Admission store against a real Postgres, rather than a fake builder.
 *
 * Every other test in this area substitutes the Supabase transport, which proves
 * the application's logic and nothing about the schema underneath it. Migrations
 * 018 and 019 were reviewed, asserted as text, and had never been executed - so
 * a wrong column name, a check constraint that rejected a legitimate row, or a
 * grant that let `anon` read operator notes would all have passed CI.
 *
 * Skipped unless LOCUS_LIVE_DB=1, because CI has no database. That makes this
 * opt-in rather than enforced, which is the honest trade: a test that silently
 * skips is worth less than one that runs, and a CI job that needs Docker and a
 * migration replay is worth more than this catches on every push. Run it after
 * changing a migration:
 *
 *   pnpm dlx supabase@2.111.0 start
 *   pnpm dlx supabase@2.111.0 db reset
 *   LOCUS_LIVE_DB=1 pnpm test admission-live
 */
const live = process.env.LOCUS_LIVE_DB === "1";

// The fixed, publicly documented defaults every local Supabase instance uses.
// They are not credentials: the same values ship with the CLI for everyone.
const LOCAL_URL = process.env.LOCUS_LIVE_DB_URL ?? "http://127.0.0.1:54421";
const LOCAL_SERVICE_KEY = process.env.LOCUS_LIVE_DB_KEY
  ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    + "eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0."
    + "EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const NEW_USER = `user_live_${Date.now()}`;
const OPERATOR_USER = `user_operator_${Date.now()}`;

describe.skipIf(!live)("Admission store against a live database", () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = LOCAL_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = LOCAL_SERVICE_KEY;
  });

  it("returns null for an account the table has never seen", async () => {
    expect(await readStoredAdmission(NEW_USER)).toBeNull();
  });

  it("admits a new account, and says the same thing on the second visit", async () => {
    // Idempotence matters against a real primary key rather than a fake that
    // cannot violate one.
    expect(await admitSelfServe(NEW_USER)).toEqual({ tier: "free", source: "self_serve" });
    expect(await admitSelfServe(NEW_USER)).toEqual({ tier: "free", source: "self_serve" });
  });

  it("survives concurrent first visits from the same account", async () => {
    // Two tabs. One of these inserts and the other takes a unique violation, so
    // this exercises the branch the fake builder can only simulate.
    const racer = `user_race_${Date.now()}`;
    const results = await Promise.all([admitSelfServe(racer), admitSelfServe(racer)]);
    expect(results).toEqual([
      { tier: "free", source: "self_serve" },
      { tier: "free", source: "self_serve" },
    ]);
  });

  it("never lets a self-serve visit overwrite an operator grant", async () => {
    await admitSelfServe(OPERATOR_USER);
    // Simulate the operator upgrade the runbook documents.
    const { createClient } = await import("@supabase/supabase-js");
    const db = createClient(LOCAL_URL, LOCAL_SERVICE_KEY);
    await db
      .from("account_admissions")
      .update({ tier: "pro", source: "operator", note: "live test" })
      .eq("user_id", OPERATOR_USER);

    expect(await admitSelfServe(OPERATOR_USER)).toEqual({ tier: "pro", source: "operator" });
  });

  it("counts self-serve rows for the ceiling", async () => {
    expect(await countSelfServeAdmissions()).toBeGreaterThanOrEqual(1);
  });

  it("reports no subscription for an account without one", async () => {
    expect(await hasActiveSubscription(NEW_USER)).toBe(false);
  });

  it("resolves a stored row into the tier, quota, and capabilities", async () => {
    const stored = await readStoredAdmission(NEW_USER);
    const admission = admissionWithCapabilities({
      userId: NEW_USER,
      partnerUserIds: "",
      subscriptionActive: false,
      selfServeOpen: true,
      emailVerified: true,
      selfServeCapacity: true,
      stored,
    });

    expect(admission.tier).toBe("free");
    expect(admission.runQuota).toEqual({ maxActiveRuns: 1, maxDailyRuns: 3 });
    expect(admission.capabilities.runStart).toBe(true);
    // The release record still withholds delivery from a real row, which is the
    // property the whole two-table design exists for.
    expect(admission.capabilities.delivery).toBe(false);
  });

  it("rejects a tier the check constraint does not allow", async () => {
    // Proves migration 018's constraint and ADMISSION_TIERS agree in the
    // database, not only in the migration's text.
    const { createClient } = await import("@supabase/supabase-js");
    const db = createClient(LOCAL_URL, LOCAL_SERVICE_KEY);
    const { error } = await db
      .from("account_admissions")
      .insert({ user_id: `user_bad_${Date.now()}`, tier: "enterprise", source: "operator" });

    expect(error?.message ?? "").toMatch(/violates check constraint/);
  });
});

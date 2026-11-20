import { sql } from "kysely";
import { describe, expect, it } from "vitest";

import { ADMISSION_TIERS } from "@/lib/admission";
import { admitSelfServe, countSelfServeAdmissions, hasActiveSubscription, readStoredAdmission } from "@/lib/admission-store";
import { setupTestDatabase } from "@/test/database";

const database = setupTestDatabase();
const USER = "user_stranger";

async function storeAdmission(tier: string, source: string, userId = USER) {
  await database().insertInto("account_admissions").values({ user_id: userId, tier, source }).execute();
}

async function admissionRows() {
  return database().selectFrom("account_admissions").select(["user_id", "tier", "source"]).execute();
}

async function storeSubscription(status: string) {
  await database().insertInto("subscriptions").values({
    user_id: USER,
    stripe_customer_id: "cus_1",
    stripe_subscription_id: "sub_1",
    status,
  }).execute();
}

describe("readStoredAdmission", () => {
  it("returns null when the account has no Admission record", async () => {
    expect(await readStoredAdmission(USER)).toBeNull();
  });

  it("returns the stored tier and its provenance", async () => {
    await storeAdmission("pro", "operator");
    expect(await readStoredAdmission(USER)).toEqual({ tier: "pro", source: "operator" });
  });

  it("reads only the caller's record", async () => {
    await storeAdmission("pro", "operator", "user_other");
    expect(await readStoredAdmission(USER)).toBeNull();
  });

  it("fails closed on an unreadable row rather than admitting the account", async () => {
    // A database error must not read as "no record", which the resolver would
    // treat as "fall through to self-serve". Losing the operator's explicit
    // `visitor` refusal during an outage is how a suspended account gets back in.
    await sql`drop table public.account_admissions`.execute(database());
    await expect(readStoredAdmission(USER)).rejects.toThrow(/Admission/i);
  });

  it("refuses a tier the application does not recognise", async () => {
    // Rows outlive deploys. A tier removed from the code but still stored must
    // not be handed to capabilitiesForTier, where it would index the table as
    // undefined and throw somewhere far from the cause.
    await sql`alter table public.account_admissions drop constraint account_admissions_tier_check`.execute(database());
    await storeAdmission("enterprise", "operator");
    await expect(readStoredAdmission(USER)).rejects.toThrow(/enterprise/);
  });
});

describe("admitSelfServe", () => {
  it("records a free Admission for an account that has none", async () => {
    expect(await admitSelfServe(USER)).toEqual({ tier: "free", source: "self_serve" });
    expect(await admissionRows()).toEqual([{ user_id: USER, tier: "free", source: "self_serve" }]);
  });

  it("returns the existing Admission without overwriting it", async () => {
    await storeAdmission("pro", "operator");
    expect(await admitSelfServe(USER)).toEqual({ tier: "pro", source: "operator" });
    expect(await admissionRows()).toEqual([{ user_id: USER, tier: "pro", source: "operator" }]);
  });

  it("never resurrects an account an operator refused", async () => {
    await storeAdmission("visitor", "operator");
    expect(await admitSelfServe(USER)).toEqual({ tier: "visitor", source: "operator" });
    expect(await admissionRows()).toEqual([{ user_id: USER, tier: "visitor", source: "operator" }]);
  });

  it("yields to the row that won when two signups race", async () => {
    // Two tabs, one new account. Both read "no record"; the loser's insert
    // violates the primary key, and the correct answer is the row that landed,
    // not an error the user sees.
    const results = await Promise.all([admitSelfServe(USER), admitSelfServe(USER)]);

    expect(results).toEqual([
      { tier: "free", source: "self_serve" },
      { tier: "free", source: "self_serve" },
    ]);
    expect(await admissionRows()).toHaveLength(1);
  });

  it("surfaces an insert failure that is not a lost race", async () => {
    await sql`alter table public.account_admissions add constraint refuse_free check (tier <> 'free')`.execute(database());
    await expect(admitSelfServe(USER)).rejects.toThrow(/Admission/i);
  });
});

describe("account_admissions constraints", () => {
  it("accepts exactly the tiers the application knows", async () => {
    // Migration 018's check constraint and ADMISSION_TIERS must agree in the
    // database, not only in the migration's text. A tier the code adds without a
    // migration would fail at the operator's first grant.
    for (const [index, tier] of ADMISSION_TIERS.entries()) {
      await storeAdmission(tier, "operator", `user_${index}`);
    }
    await expect(storeAdmission("enterprise", "operator", "user_bad")).rejects.toThrow(/violates check constraint/);
  });
});

describe("countSelfServeAdmissions", () => {
  it("counts self-serve admissions across accounts and nothing else", async () => {
    await storeAdmission("free", "self_serve", "user_a");
    await storeAdmission("free", "self_serve", "user_b");
    await storeAdmission("pro", "operator", "user_c");
    await storeAdmission("pro", "subscription", "user_d");

    expect(await countSelfServeAdmissions()).toBe(2);
  });
});

describe("hasActiveSubscription", () => {
  it("is false when the account has never subscribed", async () => {
    expect(await hasActiveSubscription(USER)).toBe(false);
  });

  it("is true for an active subscription", async () => {
    await storeSubscription("active");
    expect(await hasActiveSubscription(USER)).toBe(true);
  });

  it("is false once a subscription lapses or is cancelled", async () => {
    // The webhook writes exactly three values. Anything else is a status this
    // code has not been taught, and guessing "probably paid" from an unknown
    // string is how a lapsed account keeps a paid tier.
    await sql`alter table public.subscriptions drop constraint subscriptions_status_check`.execute(database());
    await storeSubscription("inactive");
    for (const status of ["inactive", "cancelled", "past_due", ""]) {
      await database().updateTable("subscriptions").set({ status }).where("user_id", "=", USER).execute();
      expect(await hasActiveSubscription(USER), status).toBe(false);
    }
  });

  it("fails closed on an unreadable subscription", async () => {
    await sql`drop table public.subscriptions`.execute(database());
    await expect(hasActiveSubscription(USER)).rejects.toThrow(/subscription/i);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setupTestDatabase } from "@/test/database";

/**
 * Every other Admission test checks one layer: the store against the database,
 * the server against the store, the routes against the server. Each is right on
 * its own and none of them proves the stack agrees with itself.
 *
 * This one runs the real store, the real tenant guard, the real resolver, the
 * real tier tables and a real migrated database. What it is checking is that a
 * row written by an operator reaches a decision at the top, which is the claim
 * the whole feature rests on and the one no unit test can make.
 */

vi.mock("@/lib/account-identity", () => ({
  primaryEmailVerified: async () => true,
}));

const { admissionForAccount } = await import("@/lib/admission-server");

const database = setupTestDatabase();

async function grant(userId: string, tier: string) {
  await database().insertInto("account_admissions").values({ user_id: userId, tier, source: "operator" }).execute();
}

async function subscribe(userId: string, status: string) {
  await database().insertInto("subscriptions").values({
    user_id: userId,
    stripe_customer_id: `cus_${userId}`,
    stripe_subscription_id: `sub_${userId}`,
    status,
  }).execute();
}

beforeEach(() => {
  vi.stubEnv("ALPHA_ALLOWED_USER_IDS", "");
  vi.stubEnv("LOCUS_SELF_SERVE", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Admission end to end", () => {
  it("turns an operator pro grant into pro capabilities and the pro quota", async () => {
    await grant("user_customer", "pro");

    const admission = await admissionForAccount("user_customer");

    expect(admission.tier).toBe("pro");
    expect(admission.reason).toBe("operator_grant");
    expect(admission.runQuota).toEqual({ maxActiveRuns: 5, maxRunsPerRolling24Hours: 50 });
    // Still intersected with the release record. A pro grant does not ship
    // delivery, and the point of the two-table design is that it cannot.
    expect(admission.capabilities.runStart).toBe(true);
    expect(admission.capabilities.delivery).toBe(false);
  });

  it("refuses a suspended account that is also allowlisted and subscribed", async () => {
    // The account most worth suspending is the one every other rule would admit.
    vi.stubEnv("ALPHA_ALLOWED_USER_IDS", "user_abuser");
    vi.stubEnv("LOCUS_SELF_SERVE", "open");
    await grant("user_abuser", "visitor");
    await subscribe("user_abuser", "active");

    const admission = await admissionForAccount("user_abuser");

    expect(admission.tier).toBe("visitor");
    expect(admission.reason).toBe("suspended");
    expect(admission.capabilities.runStart).toBe(false);
    expect(admission.runQuota).toEqual({ maxActiveRuns: 0, maxRunsPerRolling24Hours: 0 });
  });

  it("promotes a live subscription to pro without an operator row", async () => {
    await subscribe("user_customer", "active");

    const admission = await admissionForAccount("user_customer");

    expect(admission).toMatchObject({ tier: "pro", reason: "subscription" });
  });

  it("does not promote a cancelled subscription", async () => {
    vi.stubEnv("LOCUS_SELF_SERVE", "open");
    await subscribe("user_lapsed", "cancelled");

    const admission = await admissionForAccount("user_lapsed");

    expect(admission).toMatchObject({ tier: "free", reason: "self_serve" });
    expect(admission.runQuota).toEqual({ maxActiveRuns: 1, maxRunsPerRolling24Hours: 2 });
  });

  it("reads only the authenticated account's rows", async () => {
    // Another account's operator grant and live subscription sit in the same
    // tables. The tenant guard is what keeps a lookup for one account from
    // resolving against the other's rows.
    await grant("user_other", "pro");
    await subscribe("user_other", "active");

    const admission = await admissionForAccount("user_customer");

    expect(admission.tier).not.toBe("pro");
    expect(admission.reason).not.toBe("operator_grant");
  });
});

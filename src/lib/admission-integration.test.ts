import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

/**
 * Every other Admission test mocks the layer beneath it: the store mocks the
 * tenant client, the server mocks the store, the routes mock the server. Each is
 * right on its own and none of them proves the stack agrees with itself.
 *
 * This one substitutes only the Supabase transport - the last thing before the
 * network - and runs the real store, the real tenant guard, the real resolver,
 * and the real tier tables. What it is checking is that a row written by an
 * operator reaches a decision at the top, which is the claim the whole feature
 * rests on and the one no unit test can make.
 */

type Table = "account_admissions" | "subscriptions";

const rows: { admission: Record<string, unknown> | null; subscription: Record<string, unknown> | null } = {
  admission: null,
  subscription: null,
};

const seenFilters: Array<{ table: string; column: string; value: unknown }> = [];

function builder(table: Table) {
  const chain = {
    select: () => chain,
    eq(column: string, value: unknown) {
      seenFilters.push({ table, column, value });
      return chain;
    },
    maybeSingle: async () => ({
      data: table === "account_admissions" ? rows.admission : rows.subscription,
      error: null,
    }),
  };
  return chain;
}

vi.mock("@/lib/account-identity", () => ({
  primaryEmailVerified: async () => true,
}));

vi.mock("@/lib/supabase", () => ({
  serviceClient: () => ({ from: (table: Table) => builder(table) }),
}));

const { admissionForAccount } = await import("@/lib/admission-server");

beforeEach(() => {
  rows.admission = null;
  rows.subscription = null;
  seenFilters.length = 0;
  vi.stubEnv("ALPHA_ALLOWED_USER_IDS", "");
  vi.stubEnv("LOCUS_SELF_SERVE", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Admission end to end", () => {
  it("turns an operator pro grant into pro capabilities and the pro quota", async () => {
    rows.admission = { tier: "pro", source: "operator" };

    const admission = await admissionForAccount("user_customer");

    expect(admission.tier).toBe("pro");
    expect(admission.reason).toBe("operator_grant");
    expect(admission.runQuota).toEqual({ maxActiveRuns: 5, maxDailyRuns: 50 });
    // Still intersected with the release record. A pro grant does not ship
    // delivery, and the point of the two-table design is that it cannot.
    expect(admission.capabilities.runStart).toBe(true);
    expect(admission.capabilities.delivery).toBe(false);
  });

  it("refuses a suspended account that is also allowlisted and subscribed", async () => {
    // The account most worth suspending is the one every other rule would admit.
    vi.stubEnv("ALPHA_ALLOWED_USER_IDS", "user_abuser");
    vi.stubEnv("LOCUS_SELF_SERVE", "open");
    rows.admission = { tier: "visitor", source: "operator" };
    rows.subscription = { status: "active" };

    const admission = await admissionForAccount("user_abuser");

    expect(admission.tier).toBe("visitor");
    expect(admission.reason).toBe("suspended");
    expect(admission.capabilities.runStart).toBe(false);
    expect(admission.runQuota).toEqual({ maxActiveRuns: 0, maxDailyRuns: 0 });
  });

  it("promotes a live subscription to pro without an operator row", async () => {
    rows.subscription = { status: "active" };

    const admission = await admissionForAccount("user_customer");

    expect(admission).toMatchObject({ tier: "pro", reason: "subscription" });
  });

  it("does not promote a cancelled subscription", async () => {
    vi.stubEnv("LOCUS_SELF_SERVE", "open");
    rows.subscription = { status: "cancelled" };

    const admission = await admissionForAccount("user_lapsed");

    expect(admission).toMatchObject({ tier: "free", reason: "self_serve" });
    expect(admission.runQuota).toEqual({ maxActiveRuns: 1, maxDailyRuns: 3 });
  });

  it("scopes both reads to the authenticated account", async () => {
    // The service role bypasses RLS, so the tenant guard is the only thing
    // standing between an admission lookup and every account's tier. Asserting
    // the filters reached the client proves the guard ran rather than that it
    // exists.
    await admissionForAccount("user_customer");

    expect(seenFilters).toEqual(
      expect.arrayContaining([
        { table: "account_admissions", column: "user_id", value: "user_customer" },
        { table: "subscriptions", column: "user_id", value: "user_customer" },
      ]),
    );
  });
});

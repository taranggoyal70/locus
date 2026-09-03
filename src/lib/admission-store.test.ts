import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = { user_id: string; tier: string; source: string } | null;

const state: {
  row: Row;
  selectError: { message: string } | null;
  insertError: { code?: string; message: string } | null;
  inserts: unknown[];
} = { row: null, selectError: null, insertError: null, inserts: [] };

function builder(_table: string) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    insert(values: unknown) {
      state.inserts.push(values);
      return {
        select: () => ({
          single: async () =>
            state.insertError
              ? { data: null, error: state.insertError }
              : { data: values, error: null },
        }),
      };
    },
    maybeSingle: async () =>
      state.selectError
        ? { data: null, error: state.selectError }
        : { data: state.row, error: null },
  };
  return chain;
}

vi.mock("@/lib/supabase-tenant", () => ({
  tenantClient: () => ({ from: (table: string) => builder(table) }),
}));

const { admitSelfServe, readStoredAdmission } = await import("@/lib/admission-store");

const USER = "user_stranger";

beforeEach(() => {
  state.row = null;
  state.selectError = null;
  state.insertError = null;
  state.inserts = [];
});

describe("readStoredAdmission", () => {
  it("returns null when the account has no Admission record", async () => {
    expect(await readStoredAdmission(USER)).toBeNull();
  });

  it("returns the stored tier and its provenance", async () => {
    state.row = { user_id: USER, tier: "pro", source: "operator" };
    expect(await readStoredAdmission(USER)).toEqual({ tier: "pro", source: "operator" });
  });

  it("fails closed on an unreadable row rather than admitting the account", async () => {
    // A database error must not read as "no record", which the resolver would
    // treat as "fall through to self-serve". Losing the operator's explicit
    // `visitor` refusal during an outage is how a suspended account gets back in.
    state.selectError = { message: "connection reset" };
    await expect(readStoredAdmission(USER)).rejects.toThrow(/Admission/i);
  });

  it("refuses a tier the application does not recognise", async () => {
    // Rows outlive deploys. A tier removed from the code but still stored must
    // not be handed to capabilitiesForTier, where it would index the table as
    // undefined and throw somewhere far from the cause.
    state.row = { user_id: USER, tier: "enterprise", source: "operator" };
    await expect(readStoredAdmission(USER)).rejects.toThrow(/enterprise/);
  });
});

describe("admitSelfServe", () => {
  it("records a free Admission for an account that has none", async () => {
    expect(await admitSelfServe(USER)).toEqual({ tier: "free", source: "self_serve" });
    expect(state.inserts).toEqual([
      { user_id: USER, tier: "free", source: "self_serve" },
    ]);
  });

  it("returns the existing Admission without overwriting it", async () => {
    state.row = { user_id: USER, tier: "pro", source: "operator" };
    expect(await admitSelfServe(USER)).toEqual({ tier: "pro", source: "operator" });
    expect(state.inserts).toEqual([]);
  });

  it("never resurrects an account an operator refused", async () => {
    state.row = { user_id: USER, tier: "visitor", source: "operator" };
    expect(await admitSelfServe(USER)).toEqual({ tier: "visitor", source: "operator" });
    expect(state.inserts).toEqual([]);
  });

  it("yields to the row that won when two signups race", async () => {
    // Two tabs, one new account. The loser's insert violates the primary key;
    // the correct answer is the row that landed, not an error the user sees.
    state.insertError = { code: "23505", message: "duplicate key" };
    state.row = null;
    const settled = admitSelfServe(USER);
    state.row = { user_id: USER, tier: "free", source: "self_serve" };
    expect(await settled).toEqual({ tier: "free", source: "self_serve" });
  });

  it("surfaces an insert failure that is not a lost race", async () => {
    state.insertError = { code: "23514", message: "violates check constraint" };
    await expect(admitSelfServe(USER)).rejects.toThrow(/Admission/i);
  });
});

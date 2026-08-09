import { beforeEach, describe, expect, it, vi } from "vitest";

const executed: Array<{ table: string; filters: Array<[string, unknown]>; payload?: unknown }> = [];

// A chainable, thenable stand-in for the PostgREST builder. It records what
// would have run so a test can prove a blocked query never reached the
// database, not merely that it rejected.
function fakeBuilder(table: string) {
  const filters: Array<[string, unknown]> = [];
  let payload: unknown;

  const builder = {
    select() {
      return builder;
    },
    eq(column: string, value: unknown) {
      filters.push([column, value]);
      return builder;
    },
    insert(rows: unknown) {
      payload = rows;
      return builder;
    },
    upsert(rows: unknown) {
      payload = rows;
      return builder;
    },
    single() {
      return builder;
    },
    then(resolve: (value: { data: string; error: null }) => unknown) {
      executed.push({ table, filters, payload });
      return Promise.resolve(resolve({ data: `rows:${table}`, error: null }));
    },
  };
  return builder;
}

vi.mock("@/lib/supabase", () => ({
  serviceClient: () => ({ from: (table: string) => fakeBuilder(table) }),
}));

const { TenantScopeError, globalClient, tenantClient } = await import("@/lib/supabase-tenant");

const USER = "user_123";
const OTHER = "user_456";

beforeEach(() => {
  executed.length = 0;
});

describe("tenant-scoped service client", () => {
  it("runs a query that constrains itself to the authenticated user", async () => {
    const db = tenantClient(USER);

    const result = await db.from("projects").select("*").eq("user_id", USER);

    expect(result.data).toBe("rows:projects");
    expect(executed).toHaveLength(1);
  });

  it("refuses an unscoped query and never reaches the database", async () => {
    const db = tenantClient(USER);

    await expect(db.from("projects").select("*")).rejects.toBeInstanceOf(TenantScopeError);
    expect(executed).toHaveLength(0);
  });

  it("names the table and the fix in the failure", async () => {
    const db = tenantClient(USER);

    await expect(db.from("api_keys").select("*")).rejects.toThrow(
      /tenant table "api_keys" was not constrained/,
    );
  });

  // The wrong-variable class of IDOR: the filter is present, but it names
  // someone else.
  it("refuses a query filtered on a different user", async () => {
    const db = tenantClient(USER);

    await expect(db.from("projects").select("*").eq("user_id", OTHER)).rejects.toBeInstanceOf(
      TenantScopeError,
    );
    expect(executed).toHaveLength(0);
  });

  it("does not accept an unrelated column as a tenant filter", async () => {
    const db = tenantClient(USER);

    await expect(db.from("agent_runs").select("*").eq("id", "run_1")).rejects.toBeInstanceOf(
      TenantScopeError,
    );
  });

  it("carries the scope through a longer chain", async () => {
    const db = tenantClient(USER);

    const result = await db
      .from("agent_runs")
      .select("*")
      .eq("id", "run_1")
      .eq("user_id", USER)
      .single();

    expect(result.data).toBe("rows:agent_runs");
    expect(executed).toHaveLength(1);
  });

  it("accepts an insert that carries the authenticated user", async () => {
    const db = tenantClient(USER);

    await db.from("projects").insert({ user_id: USER, name: "demo" } as never);

    expect(executed).toHaveLength(1);
  });

  it("refuses an insert attributed to someone else", async () => {
    const db = tenantClient(USER);

    await expect(
      db.from("projects").insert({ user_id: OTHER, name: "demo" } as never),
    ).rejects.toBeInstanceOf(TenantScopeError);
    expect(executed).toHaveLength(0);
  });

  it("refuses an insert with no owner at all", async () => {
    const db = tenantClient(USER);

    await expect(db.from("projects").insert({ name: "demo" } as never)).rejects.toBeInstanceOf(
      TenantScopeError,
    );
  });

  it("requires every row of a bulk insert to belong to the caller", async () => {
    const db = tenantClient(USER);

    await expect(
      db.from("events").insert([
        { user_id: USER, event: "a" },
        { user_id: OTHER, event: "b" },
      ] as never),
    ).rejects.toBeInstanceOf(TenantScopeError);
  });

  it("leaves tables without a user column unguarded", async () => {
    const db = tenantClient(USER);

    // `teams` is owned via team_members, so there is no per-user column to
    // filter on and guarding it would only produce false failures.
    const result = await db.from("teams").select("*");

    expect(result.data).toBe("rows:teams");
    expect(executed).toHaveLength(1);
  });

  it("requires an authenticated user id", () => {
    expect(() => tenantClient("")).toThrow("tenantClient requires an authenticated user id");
  });
});

describe("explicit cross-tenant access", () => {
  it("runs an unscoped query when the caller states a reason", async () => {
    const db = globalClient("stripe webhook has no authenticated user");

    const result = await db.from("subscriptions").select("*");

    expect(result.data).toBe("rows:subscriptions");
  });

  it("refuses to hand out an unlabelled escape hatch", () => {
    expect(() => globalClient("  ")).toThrow("globalClient requires a reason");
  });
});

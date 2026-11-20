import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { globalDb, TENANT_TABLES, TenantScopeError, tenantDb } from "@/lib/db/tenant";
import { createTestDatabase, type TestDatabase } from "@/test/database";

const USER = "user_123";
const OTHER = "user_456";

let database: TestDatabase;

async function seedProject(userId: string, name: string) {
  await database.insertInto("projects")
    .values({ user_id: userId, name, repo_url: "https://github.com/a/b", task: "t" })
    .execute();
}

async function projectNames() {
  const rows = await database.selectFrom("projects").select("name").orderBy("name").execute();
  return rows.map((row) => row.name);
}

beforeEach(async () => {
  database = await createTestDatabase();
  await seedProject(USER, "mine");
  await seedProject(OTHER, "theirs");
});

afterEach(async () => {
  await database.destroy();
});

describe("tenant-scoped database access", () => {
  it("runs a query that constrains itself to the authenticated user", async () => {
    const rows = await tenantDb(USER, database).selectFrom("projects").selectAll().where("user_id", "=", USER).execute();

    expect(rows.map((row) => row.name)).toEqual(["mine"]);
  });

  it("refuses an unscoped query", async () => {
    await expect(tenantDb(USER, database).selectFrom("projects").selectAll().execute())
      .rejects.toBeInstanceOf(TenantScopeError);
  });

  it("names the table and the fix in the failure", async () => {
    await expect(tenantDb(USER, database).selectFrom("api_keys").selectAll().execute())
      .rejects.toThrow(/tenant table "api_keys" was not constrained/);
  });

  // The wrong-variable class of IDOR: the filter is present, but it names
  // someone else.
  it("refuses a query filtered on a different user", async () => {
    await expect(tenantDb(USER, database).selectFrom("projects").selectAll().where("user_id", "=", OTHER).execute())
      .rejects.toBeInstanceOf(TenantScopeError);
  });

  it("does not accept an unrelated column as a tenant filter", async () => {
    await expect(tenantDb(USER, database).selectFrom("agent_runs").selectAll()
      .where("id", "=", "00000000-0000-0000-0000-000000000000").execute())
      .rejects.toBeInstanceOf(TenantScopeError);
  });

  it("does not accept the user filter inside a disjunction", async () => {
    await expect(tenantDb(USER, database).selectFrom("projects").selectAll()
      .where((eb) => eb.or([eb("user_id", "=", USER), eb("name", "=", "theirs")])).execute())
      .rejects.toBeInstanceOf(TenantScopeError);
  });

  it("does not accept a user filter with another operator", async () => {
    await expect(tenantDb(USER, database).selectFrom("projects").selectAll().where("user_id", "!=", USER).execute())
      .rejects.toBeInstanceOf(TenantScopeError);
  });

  it("carries the scope through a longer chain", async () => {
    const row = await tenantDb(USER, database).selectFrom("projects").selectAll()
      .where("name", "=", "mine").where("user_id", "=", USER).executeTakeFirst();

    expect(row?.name).toBe("mine");
  });

  it("refuses an unscoped delete and leaves every row in place", async () => {
    await expect(tenantDb(USER, database).deleteFrom("projects").where("name", "=", "theirs").execute())
      .rejects.toBeInstanceOf(TenantScopeError);

    expect(await projectNames()).toEqual(["mine", "theirs"]);
  });

  it("refuses an unscoped update and changes nothing", async () => {
    await expect(tenantDb(USER, database).updateTable("projects").set({ name: "taken" }).execute())
      .rejects.toBeInstanceOf(TenantScopeError);

    expect(await projectNames()).toEqual(["mine", "theirs"]);
  });

  it("updates only the caller's rows when scoped", async () => {
    await tenantDb(USER, database).updateTable("projects").set({ name: "renamed" }).where("user_id", "=", USER).execute();

    expect(await projectNames()).toEqual(["renamed", "theirs"]);
  });

  it("accepts an insert that carries the authenticated user", async () => {
    await tenantDb(USER, database).insertInto("projects")
      .values({ user_id: USER, name: "new", repo_url: "u", task: "t" }).execute();

    expect(await projectNames()).toEqual(["mine", "new", "theirs"]);
  });

  it("refuses an insert attributed to someone else and writes nothing", async () => {
    await expect(tenantDb(USER, database).insertInto("projects")
      .values({ user_id: OTHER, name: "forged", repo_url: "u", task: "t" }).execute())
      .rejects.toBeInstanceOf(TenantScopeError);

    expect(await projectNames()).toEqual(["mine", "theirs"]);
  });

  it("requires every row of a bulk insert to belong to the caller", async () => {
    await expect(tenantDb(USER, database).insertInto("events").values([
      { user_id: USER, event: "a" },
      { user_id: OTHER, event: "b" },
    ]).execute()).rejects.toBeInstanceOf(TenantScopeError);

    const events = await database.selectFrom("events").select("event").execute();
    expect(events).toEqual([]);
  });

  it("accepts an upsert whose rows belong to the caller", async () => {
    const write = () => tenantDb(USER, database).insertInto("github_connections")
      .values({ user_id: USER, github_username: "me", access_token: "sealed" })
      .onConflict((conflict) => conflict.column("user_id").doUpdateSet({ github_username: "me-again" }))
      .execute();
    await write();
    await write();

    const rows = await database.selectFrom("github_connections").select("github_username").execute();
    expect(rows).toEqual([{ github_username: "me-again" }]);
  });

  it("leaves tables without a user column unguarded", async () => {
    // `teams` is owned via team_members, so there is no per-user column to
    // filter on and guarding it would only produce false failures.
    await expect(tenantDb(USER, database).selectFrom("teams").selectAll().execute()).resolves.toEqual([]);
  });

  it("refuses a join that brings a second table into reach", async () => {
    await expect(tenantDb(USER, database).selectFrom("projects")
      .innerJoin("api_keys", "api_keys.user_id", "projects.user_id")
      .selectAll("projects").where("projects.user_id", "=", USER).execute())
      .rejects.toBeInstanceOf(TenantScopeError);
  });

  it("requires an authenticated user id", () => {
    expect(() => tenantDb("", database)).toThrow("tenantDb requires an authenticated user id");
  });
});

describe("explicit cross-tenant access", () => {
  it("runs an unscoped query when the caller states a reason", async () => {
    const rows = await globalDb("retention spans every account", database).selectFrom("projects").select("name").execute();

    expect(rows).toHaveLength(2);
  });

  it("refuses to hand out an unlabelled escape hatch", () => {
    expect(() => globalDb("  ", database)).toThrow("globalDb requires a reason");
  });
});

describe("guarded tables", () => {
  // R7 depends on the guard knowing every table that carries a per-user column.
  // The set is generated from the migrated schema, so this reads the live
  // catalog and derives it again: a table added without regenerating the types
  // would lose its fail-closed guard silently.
  it("names exactly the tables whose rows carry a user_id", async () => {
    const rows = await database.selectFrom("information_schema.columns" as never)
      .select("table_name" as never)
      .where("table_schema" as never, "=", "public" as never)
      .where("column_name" as never, "=", "user_id" as never)
      .execute() as { table_name: string }[];

    expect(rows.map((row) => row.table_name).sort()).toEqual([...TENANT_TABLES].sort());
  });
});

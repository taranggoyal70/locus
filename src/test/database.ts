import fs from "node:fs";

import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { Kysely, PGliteDialect } from "kysely";
import { afterEach, beforeEach, inject } from "vitest";

import { RESULT_PARSERS } from "@/lib/db/parsers";
import type { Database } from "@/lib/db/schema";

export type TestDatabase = Kysely<Database> & { pglite: PGlite };

/**
 * A fresh PostgreSQL, in process, with every migration applied: the same schema,
 * constraints, triggers and SQL functions production runs, and the same result
 * parsers as the production client. Each call is an independent database, so a
 * test file can create one in beforeEach and never see another test's rows.
 */
let template: Blob | undefined;

export async function createTestDatabase(): Promise<TestDatabase> {
  template ??= new Blob([fs.readFileSync(inject("databaseTemplate"))]);
  const pglite = await PGlite.create({
    loadDataDir: template,
    extensions: { pgcrypto },
    parsers: RESULT_PARSERS,
  });
  const database = new Kysely<Database>({ dialect: new PGliteDialect({ pglite }) });
  return Object.assign(database, { pglite });
}

let installed: TestDatabase | undefined;

/** The database setupTestDatabase() installed for the running test, if any. */
export function installedTestDatabase(): TestDatabase | undefined {
  return installed;
}

/**
 * Gives every test in the calling file its own fresh, fully migrated database,
 * and makes it the one the application's db() returns. Read it through the
 * returned function inside a test or hook.
 */
export function setupTestDatabase(): () => TestDatabase {
  beforeEach(async () => {
    installed = await createTestDatabase();
  });
  afterEach(async () => {
    const database = installed;
    installed = undefined;
    await database?.destroy();
  });
  return () => {
    if (!installed) throw new Error("setupTestDatabase() is only available inside a test or hook.");
    return installed;
  };
}

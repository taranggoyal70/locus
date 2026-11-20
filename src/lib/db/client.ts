import { attachDatabasePool } from "@vercel/functions";
import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";

import { RESULT_PARSERS } from "@/lib/db/parsers";

import { withVerifiedTls } from "../../../db/connection-string.mjs";
import type { Database } from "@/lib/db/schema";

let instance: Kysely<Database> | null = null;

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("DATABASE_URL is not set");
    this.name = "DatabaseNotConfiguredError";
  }
}

export function databaseConfigured(environment: Record<string, string | undefined> = process.env): boolean {
  return Boolean(environment.DATABASE_URL?.trim());
}

function typeParser(oid: number, format?: string) {
  const parser = RESULT_PARSERS[oid];
  if (parser && format !== "binary") return parser;
  return pg.types.getTypeParser(oid, format as "text");
}

/**
 * The process-wide database handle. The pool is created on first use, so a
 * build or a route that never touches the database never opens a connection.
 *
 * DATABASE_URL is the pooled (PgBouncer) endpoint the Neon integration
 * provides. Fluid compute keeps a function instance alive across requests, so
 * the pool is reused, and attachDatabasePool closes idle clients before the
 * instance is suspended rather than leaking them to the database.
 */
export function db(): Kysely<Database> {
  if (instance) return instance;
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new DatabaseNotConfiguredError();
  const pool = new pg.Pool({
    connectionString: withVerifiedTls(connectionString),
    max: 5,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 5_000,
    types: { getTypeParser: typeParser as typeof pg.types.getTypeParser },
  });
  attachDatabasePool(pool);
  instance = new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
  return instance;
}

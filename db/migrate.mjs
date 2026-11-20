#!/usr/bin/env node
// Applies db/migrations in order and records each one, so a database is always at
// a known point in the chain. The same function builds the production database on
// Neon, the in-process PostgreSQL every test runs against, and the schema the
// generated TypeScript types are read from, so all three are the same schema.
//
// Migrations are append-only. Each applied file's SHA-256 is stored, and a file
// that changed after it was applied stops the run: editing history would leave
// existing databases and fresh ones silently different.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { withVerifiedTls } from "./connection-string.mjs";

export const MIGRATIONS_DIR = fileURLToPath(new URL("./migrations/", import.meta.url));

const LEDGER = "public.schema_migrations";
// Any constant works; it only has to be the same for every migrator, so two
// deploys racing to migrate take turns instead of interleaving.
const LOCK_KEY = 4_812_771;

export function readMigrations(dir = MIGRATIONS_DIR) {
  return fs.readdirSync(dir)
    .filter((name) => /^\d{3}_[a-z0-9_]+\.sql$/.test(name))
    .sort()
    .map((name) => {
      const sql = fs.readFileSync(path.join(dir, name), "utf8");
      return { name, sql, checksum: crypto.createHash("sha256").update(sql).digest("hex") };
    });
}

/**
 * @param {{ query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }>, exec: (text: string) => Promise<unknown> }} database
 *   Anything that can run a parameterised query and a multi-statement script:
 *   a node-postgres client or a PGlite instance.
 * @returns {Promise<string[]>} the names of the migrations applied by this call.
 */
export async function migrate(database, { migrations = readMigrations(), log = () => {} } = {}) {
  await database.exec(`create table if not exists ${LEDGER} (
    name text primary key,
    checksum text not null,
    applied_at timestamptz not null default now()
  )`);
  await database.query("select pg_advisory_lock($1)", [LOCK_KEY]);
  try {
    const { rows } = await database.query(`select name, checksum from ${LEDGER}`);
    const applied = new Map(rows.map((row) => [row.name, row.checksum]));
    const known = new Set(migrations.map((migration) => migration.name));
    const unknown = [...applied.keys()].filter((name) => !known.has(name));
    if (unknown.length) {
      throw new Error(`Database has migrations this checkout does not: ${unknown.join(", ")}`);
    }

    const ran = [];
    for (const migration of migrations) {
      const checksum = applied.get(migration.name);
      if (checksum === migration.checksum) continue;
      if (checksum) {
        throw new Error(`${migration.name} changed after it was applied. Add a new migration instead.`);
      }
      await database.exec("begin");
      try {
        await database.exec(migration.sql);
        await database.query(`insert into ${LEDGER} (name, checksum) values ($1, $2)`, [
          migration.name,
          migration.checksum,
        ]);
        await database.exec("commit");
      } catch (error) {
        await database.exec("rollback");
        throw new Error(`${migration.name} failed: ${error instanceof Error ? error.message : String(error)}`, {
          cause: error,
        });
      }
      log(`applied ${migration.name}`);
      ran.push(migration.name);
    }
    return ran;
  } finally {
    await database.query("select pg_advisory_unlock($1)", [LOCK_KEY]);
  }
}

async function main() {
  // Migrations need a session (advisory lock, multi-statement transactions), so
  // prefer the direct endpoint over the transaction-pooled one when both exist.
  const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("Set DATABASE_URL (or DATABASE_URL_UNPOOLED) to the database to migrate.");
    process.exit(1);
  }
  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: withVerifiedTls(connectionString) });
  await client.connect();
  try {
    const exec = (text) => client.query(text);
    const ran = await migrate({ query: (text, params) => client.query(text, params), exec }, {
      log: (line) => console.log(line),
    });
    console.log(ran.length ? `${ran.length} migration(s) applied.` : "Database is up to date.");
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

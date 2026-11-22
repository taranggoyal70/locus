import { sql, type RawBuilder } from "kysely";

import type { Json } from "@/lib/db/schema";

/**
 * A value for a jsonb column. node-postgres serialises a JavaScript array as a
 * PostgreSQL array literal, which a jsonb column rejects or misreads, so every
 * jsonb write binds the JSON text and casts it explicitly instead of relying on
 * the driver's guess.
 */
export function jsonb(value: Json | undefined): RawBuilder<Json> {
  return sql<Json>`cast(${JSON.stringify(value ?? null)} as jsonb)`;
}

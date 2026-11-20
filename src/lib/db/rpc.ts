import { sql, type Kysely } from "kysely";

import { FUNCTION_ARGUMENTS, TABLE_FUNCTIONS, type Database, type Functions } from "@/lib/db/schema";

type FunctionName = keyof Functions;

/**
 * Calls a SQL function in `public` and returns what it returns: the rows of a
 * `returns table (…)` function, or the value of a scalar one.
 *
 * Arguments are passed by name and cast to the type the function declares, read
 * from the generated schema. The cast matters for two of them: node-postgres
 * would send a JavaScript array bound for a `jsonb` parameter as a PostgreSQL
 * array literal, and an untyped array as text. Names and types both come from the
 * generated catalog, never from the caller, so nothing here is interpolated
 * from input.
 */
export async function rpc<Name extends FunctionName>(
  database: Kysely<Database>,
  name: Name,
  args: Functions[Name]["args"],
): Promise<Functions[Name]["returns"]> {
  const declared: Record<string, string> = FUNCTION_ARGUMENTS[name];
  const entries = Object.entries(args).filter(([, value]) => value !== undefined);
  for (const [argument] of entries) {
    if (!Object.hasOwn(declared, argument)) {
      throw new Error(`${String(name)} has no argument named ${argument}`);
    }
  }
  const parameters = entries.map(([argument, value]) => {
    const type = declared[argument];
    const bound = type === "jsonb" || type === "json" ? JSON.stringify(value) : value;
    return sql`${sql.raw(argument)} => ${bound}::${sql.raw(type)}`;
  });
  const call = sql`${sql.id("public", String(name))}(${sql.join(parameters)})`;

  if (TABLE_FUNCTIONS.has(name)) {
    const result = await sql<Record<string, unknown>>`select * from ${call}`.execute(database);
    return result.rows as Functions[Name]["returns"];
  }
  const result = await sql<{ value: unknown }>`select ${call} as value`.execute(database);
  return (result.rows[0]?.value ?? null) as Functions[Name]["returns"];
}

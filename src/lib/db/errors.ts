/**
 * The SQLSTATE of a database error (for example "23505", unique_violation), or
 * null when the error did not come from PostgreSQL. node-postgres and PGlite
 * both expose it as `code`.
 */
export function databaseErrorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && /^[0-9A-Z]{5}$/.test(code) ? code : null;
}

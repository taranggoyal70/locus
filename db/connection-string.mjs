// node-postgres currently treats sslmode=prefer, require and verify-ca as
// verify-full, and warns on every new connection pool that the next major
// version will weaken them to libpq's meaning. Neon's connection strings say
// `require`. Naming verify-full outright keeps today's behaviour (the server
// certificate and host name are verified) through that upgrade, and stops a
// warning on every cold start.
const ALIASES_OF_VERIFY_FULL = new Set(["prefer", "require", "verify-ca"]);

/** The connection string with its TLS mode stated as the verification it already gets. */
export function withVerifiedTls(connectionString) {
  const url = new URL(connectionString);
  const mode = url.searchParams.get("sslmode");
  if (mode && ALIASES_OF_VERIFY_FULL.has(mode)) url.searchParams.set("sslmode", "verify-full");
  return url.toString();
}

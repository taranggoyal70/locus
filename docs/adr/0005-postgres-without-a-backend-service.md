# ADR-0005: Plain PostgreSQL on Neon, without a backend service

Date: 2026-11-19
Status: accepted

## Context

Locus stored everything in a Supabase project and reached it only through
`@supabase/supabase-js`, using the service role key from server code. Nothing
used Supabase Auth, Storage, Realtime or the browser client: Clerk owns identity,
and every query ran on the server as the service role, which bypasses row-level
security. The one Supabase-specific thing the application relied on was the REST
API (PostgREST) as a query transport.

That transport cost more than it gave:

- The free project paused after a week without traffic. On 2026-11-19 production
  went down with every database read failing until the project was resumed by
  hand from the dashboard.
- PostgREST queries are built from strings (`.eq("user_id", id)`,
  `.or("status.neq.failed,...")`), so a column rename or a typo in a filter is a
  runtime error, and `database.types.ts` was kept in step with the migrations
  by hand.
- Tests mocked the client's builder chain. They proved the route called the
  builder in a certain order, not that the query was right, and the migrations'
  SQL functions were never executed in CI. Two tests that did run them were
  opt-in behind a live local Supabase.

## Decision

Use a plain PostgreSQL database on Neon, provisioned through the Vercel
Marketplace, and talk to it directly.

- **Client.** Kysely over a `pg` pool on `DATABASE_URL` (Neon's pooled
  endpoint), registered with `attachDatabasePool` so Fluid compute closes idle
  clients before an instance is suspended. Result parsers return timestamps,
  dates and `bigint` in the same JSON shapes the REST API did, so stored payloads
  and API responses do not change meaning.
- **Types.** `src/lib/db/schema.ts` is generated from the migration chain by
  replaying it into an in-process PostgreSQL (`pnpm db:types`). CI fails when it
  is stale, so the types cannot drift from the schema.
- **Tenant isolation.** The server still connects as the table owner, so RLS is
  still not what isolates tenants, exactly as with the service role before. The
  tenant guard (R7) now inspects Kysely's operation tree: a query on any table
  with a `user_id` column must constrain `user_id` to the authenticated user with
  a top-level equality, every inserted row must carry that user, and joins are
  refused. Cross-tenant work goes through `globalDb(reason)`, so the exceptions
  stay enumerable. The RLS policies and role grants in the migrations remain as
  defence in depth for any other role.
- **SQL functions.** `rpc(db, name, args)` calls them with named arguments cast
  to the declared types read from the generated catalog.
- **Migrations.** `db/migrations` is append-only. `db/migrate.mjs` takes an
  advisory lock, applies each new file in its own transaction, and records its
  SHA-256 in `public.schema_migrations`; it refuses to run if an applied file was
  edited or is missing. Migration `000` creates the roles and the `extensions`
  schema the Supabase-era migrations assume, so the chain replays unchanged on
  any PostgreSQL 15 or newer. Readiness reports the database unready until the
  newest migration the build knows about is recorded.
- **Tests.** Each database test gets its own PGlite database cloned from a
  migrated template, so routes, constraints, triggers and SQL functions run
  against the real schema on every `pnpm test`.

## Consequences

- An idle Neon compute suspends and wakes on the next connection, costing a
  cold start of a few hundred milliseconds instead of an outage that needs a
  person.
- Query mistakes are compile errors, and the tests exercise the real SQL. The
  suite is slower (about 75 to 115 seconds) because every database test boots
  its own PostgreSQL.
- The R7 residual narrows but does not close: tenant isolation is still enforced
  in the application, not by a per-user database role.
- Moving providers again needs only a connection string and `pnpm db:migrate`.
- The Supabase-era rollout runbooks in `docs/operations` are kept as history.
  New database work follows `docs/operations/neon-database.md`.

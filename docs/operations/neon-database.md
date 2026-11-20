# Production database (Neon)

Locus stores everything in one PostgreSQL database on Neon (resource `locus-db`,
`us-east-1`), connected to the Vercel project through the Marketplace
integration for **Production only**. The integration sets `DATABASE_URL`
(pooled) and `DATABASE_URL_UNPOOLED` (direct) as Sensitive variables, so they
cannot be pulled back out of Vercel. See ADR 0005 for why.

## Apply migrations

Migrations are not applied by a deploy. Apply them before merging a change that
needs them, so the running build never sees a schema it does not know:

Copy the direct (unpooled) connection string from the Neon console (**Open in
Neon** on the `locus-db` page in Vercel, then **Connect**) and pass it for this
one command only, so it never lands in a file:

```bash
DATABASE_URL_UNPOOLED='postgresql://…' pnpm db:migrate
```

`pnpm db:migrate` prefers `DATABASE_URL_UNPOOLED`, takes an advisory lock so two
runs cannot interleave, applies each new file in its own transaction, and
records it with its SHA-256 in `public.schema_migrations`. It stops without
changing anything if an applied file was edited or is missing from the
checkout. A second run prints `Database is up to date.`

Migrations must stay compatible with the build that is still serving traffic
while they run: add columns and tables first, and remove them in a later
release.

## Verify

```bash
curl -s https://locus-five-iota.vercel.app/api/health
```

`readiness.missing` must not contain `database`. Readiness reports the database
unready until the newest migration the build was compiled against
(`SCHEMA_VERSION` in `src/lib/db/schema.ts`) is recorded, so a deploy that runs
ahead of its migration says so instead of failing on the first query.

## Moving from Supabase (2026-11)

The Supabase project `locus-production` remains intact, and its variables stay
in Vercel until Neon has served production cleanly. The move:

1. Apply the migrations to the empty Neon database (`pnpm db:migrate`), and
   compare its catalog with a PGlite replay of the same chain.
2. Shortly before merging, export the rows from the Supabase SQL editor as one
   JSON document, one key per table, in foreign-key order: `agent_tasks`,
   `agent_runs`, `agent_steps`, `agent_artifacts`, `agent_approvals`, `api_keys`,
   `events`. Rate-limit windows are ephemeral and are not copied.
3. Load it into Neon in one transaction with
   `insert into public.<table> select * from json_populate_recordset(null::public.<table>, $1)`,
   which keeps ids and timestamps, then compare row counts with the export.
4. Merge. The deploy reads and writes Neon from then on.
5. After a day without database errors, remove `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` from Vercel.

Rollback before step 5 is a revert of the merge: the previous build still reads
Supabase, which keeps every row written before the move.

## Preview and development

`locus-db` is attached to Production only (since 2026-11-19), so Preview and
Development deployments have no database: `/api/health` reports `database`
missing and database routes fail closed, as they did under Supabase. To give
previews a database, enable **Create Database Branch For Deployment > Preview**
on the connection, which gives each preview its own Neon branch; never attach
`locus-db` itself. Local development uses its own database (a Neon branch or a
local PostgreSQL) in `.env.local`.

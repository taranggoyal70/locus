# Changelog

Notable changes to Locus. Versions follow `package.json`; dates are UTC. This file is written by hand.

## Unreleased

### Security

- Upgrade Next.js from 16.3.4 to 16.4.6, closing two critical unauthenticated remote code execution advisories
  that affect every 16.x release up to 16.4.0. Patch the remaining high-severity transitive advisories (undici,
  brace-expansion, devalue, vite, proxy-addr, body-parser, source-map-js, sharp, zod) inside their current major
  lines, so `pnpm audit --audit-level high` passes again.

### Changed

- The database moved from Supabase to Neon Postgres. The application now talks to Postgres directly through
  Kysely and `pg` instead of the Supabase REST API, with query types generated from the migrations
  (`pnpm db:types`) and a `pnpm db:migrate` runner that records a checksum for every applied file. Tenant
  scoping is enforced on the query itself: a per-user query that does not filter on the signed-in user is
  refused before it reaches the database. Configuration is `DATABASE_URL` in place of the three Supabase
  variables. See [ADR 0005](docs/adr/0005-postgres-without-a-backend-service.md).
- Database tests run against an in-process PostgreSQL with every migration applied, instead of mocked clients.
  The Stripe ordering contract and the Admission store, previously opt-in against a live database, now run in CI.

### Fixed

- The team member route, not yet released, never enforced its ten-member limit. The count is now checked
  before the insert.
- Removing a GitHub connection reported success when the delete failed.
- The Stripe webhook acknowledged events whose database write had failed, so Stripe never retried them and a
  paid checkout or cancellation could be lost. A failed write now returns 500; a refused stale or duplicate event
  still returns 200.
- The API documentation tables now fill their bordered container.

### Added

- A held-out localization benchmark over six third-party TypeScript repositories, with a frozen protocol, a
  rule-based case selection that scores every case, a random-Slice baseline and a scope-removed ablation
  (`pnpm benchmark:heldout`).
- Generated README graphics with a CI staleness check (`pnpm readme:assets --check`): an animated hero replaying
  one real held-out run in dark, light and phone layouts, and the held-out recall chart.
- `CONTRIBUTING.md`, and every variable the app and CLI read documented in `.env.example`.

## 0.4.0

Locus Guard v0.4, the public beta of self-serve localization, and the thin API client. Released before this
changelog existed; see the [commit history](https://github.com/taranggoyal70/locus/commits/main) for detail.

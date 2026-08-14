# Security Architecture Review: implementation status

Tracks the seventeen risks from the Locus Security Architecture Review against
what is actually on `main`. Each entry states what shipped and, where the fix is
partial, what is still missing. A risk marked closed with a residual is not a
risk that was quietly downgraded.

## Closed

| Risk | Priority | Commit | What shipped |
| --- | --- | --- | --- |
| R1 | P0 Critical | `a34ed5d` | Candidate frozen in one capture; reviewed diff built server-side from the trusted base; publishing refused unless `apply(diff, base) == candidate` |
| R2 | P0 Critical/High | `64a60e8` | Egress revoked before any repository-controlled program runs; verification fails closed if the revocation did not take |
| R3 | P0/P1 High | `4b671b8`, `67c3fbd` | Canonical containment inside the sandbox, rejecting symlinks, escapes and non-regular files per path component; Slice search now uses that boundary instead of explicit `rg` path arguments |
| R5 | P1 High | `74c2e68` | Server-side MCP root allowlist; bounded JSON-RPC framing |
| R6 | P1 High | `528d323` | Widen justification enforced and bound into `proposal_hash`; widened-file ceiling; six sensitive-path classes that fail closed |
| R7 | P1 High | `e024154` | Unscoped tenant queries fail closed; no API route holds a raw service client |
| R8 | P1 High | `72bf003`, `2eb0e18` | Actions SHA-pinned, all-dependency audit, CodeQL, five advisories resolved |
| R11 | P1 High | `032df7f` | Runs refuse to start against a truncated repository |
| R9 | P1 High | `9bda750` | DOCX archive validated structurally from the End of Central Directory record (ZIP half only, see below) |
| R10 | P1 High | `5834cc8` | Delivery approval bound to the reviewed proposal hash; workflow pinned to the deployment that started it |
| R12 | P2 Medium | `c520816`, `1acfc13` | Context budget clamped; wildcard CORS replaced with an allowlist; Agent Run active and daily quota claims now count and insert atomically |
| R13 | P2 Medium/High | `31fd609` | Analytics records the shape of user content on both ingress paths, never its words |
| R14 | P2 Medium/High | `31fd609` | Model resolution fails closed against a production allowlist |
| R15 | P2 Medium | `3a91b80` | Secrets redacted by value shape, not only field name |
| R16 | P2 Medium | `3a91b80` | Security headers pinned by tests rather than living unasserted in config |
| R17 | P3 Medium/Low | `3a91b80` | Webhook body bounded in front of the read (ceiling only, see below) |

The additions are security regression tests that execute the attacks: a
symlinked escape, a Slice-search symlink leak, an MCP root escape, an oversized
JSON-RPC frame, a diff that hides what the candidate contains, an unscoped tenant
query, a widen of a sensitive path, and browser-forged delivery approval
requests.

## Residuals on closed risks

These are real and should not be forgotten because the row above says closed.

- **R1 / R2.** Verification isolation is implemented but not yet verified on the
  deployment target. Path *enumeration* still uses sandbox `git`. See
  `candidate-integrity-hardening.md` for the owner record.
- **R3.** `createDiff()` and `changeSet()` invoke `git` directly and sit outside
  containment. Subsumed by the R1 residual.
- **R7.** `src/lib` (rate-limit, api-auth, run-store) and the run workflow still
  use the raw service client. They need different treatment rather than a tenant
  filter: the workflow resolves a run by id *before* it knows the owner, and
  api-auth resolves an API key before it knows the user. Separately, this is not
  the review's literal recommendation, which is a least-privilege database role
  with Clerk to Supabase JWT so RLS applies per user. What shipped removes the
  default cross-tenant failure mode; it does not remove the service role.
- **R17.** The body ceiling shipped. The idempotency ledger did not, and on
  inspection it was not the live risk: all three Stripe handlers are last-write-wins
  writes, so processing one event twice writes the same values, and Stripe's
  signature timestamp tolerance already rejects a captured body replayed later.
  What was live is *ordering*. Stripe does not guarantee delivery order, and a
  delayed `customer.subscription.updated` carrying `status: active` arriving after
  `customer.subscription.deleted` restored paid access to a cancelled account —
  reproduced against this schema, `free/cancelled` becoming `free/active`.
  Migration 017 records which event last wrote each subscription row and refuses an
  event that is older than, or identical to, the one already applied. The
  comparison and the write are one statement, because reading the watermark and
  then writing would reintroduce the race closed in 016. Duplicate suppression
  therefore comes for free, which is the ledger the review asked for, but it is not
  what was protecting anything. The route also had no tests at all despite granting
  and revoking paid access; it now has ten, five of which fail against the previous
  implementation.
- **CSRF on mutation routes.** `POST /api/agent/runs/[id]/approve` used an inline
  `sec-fetch-site === "cross-site"` check while every other mutation route used the
  shared `sameOriginMutation` guard. The inline form allowed `same-site` (a sibling
  subdomain), a request carrying no Fetch Metadata, and a foreign `Origin` — on the
  one route that writes to GitHub. Latent rather than live, because
  `alphaCapabilitiesForUser().delivery` is false and returns 403 first, so the check
  was unreachable. Now on the shared guard, with three regression tests covering the
  cases the inline form let through.

## The migration chain does not apply to a fresh database

Found while standing up a local database to test the R12 fix, and unresolved
because it is a decision rather than a patch.

`004_harden_public_writes.sql` aborts on a new database with
`service_role must retain INSERT on public.events`. Its `do $$` block is a
precondition assertion that runs before any revoke, and the assertion is correct:
`service_role` genuinely has no INSERT.

The cause is that no migration grants table privileges explicitly. Supabase's
default ACLs for schema `public` are attached to objects created by
`supabase_admin`, while migrations run as `postgres`:

```
default_acl = anon=arwdDxtm/supabase_admin | authenticated=… | service_role=arwdDxtm/supabase_admin
has_table_privilege('service_role', <table created by postgres>, 'INSERT') = false
```

So the privilege posture of this database is not written down anywhere. It is a
consequence of which role happened to create each table, which means the schema
cannot be rebuilt from its own migrations — staging, disaster recovery, and any
audit of who can write what all depend on that. It also means `004`, whose whole
purpose is restricting public writes, has never been exercised from a clean
state.

Once that single grant is supplied, all sixteen migrations apply in order and
produce the expected 16 public tables, so this is the only blocker.

Fixing it properly means granting explicitly next to each table's creation, which
edits migrations that already ran in production. That is safe only if the added
grants match production's real ACLs — otherwise fresh environments diverge from
production, which is worse than the current state. Confirm the production grants
before changing the chain.

## Open

| Risk | Priority | Why it is still open |
| --- | --- | --- |
| R4 | P0 *before enablement* | Dormant, and deliberately not built. GitHub connection, private repository reading, and delivery are hard-disabled (`alpha-capabilities.ts`), and migration 011 deleted stored tokens. Building the GitHub App path now would ship an auth surface nothing exercises, which drifts out of step with the delivery flow before that flow ever runs. It belongs in the same change that enables delivery. |

## Notes on the risks closed in this pass

- **R9.** Only the ZIP-validation half shipped. Parsing still runs in the web
  application process rather than a resource-capped, network-denied worker. It
  was not attempted for two reasons: a `Promise` race cannot interrupt a
  CPU-bound parser holding the event loop, so an in-process timeout would look
  like a fix without being one, and a worker in this runtime needs verification
  on the deployment target that a local build does not provide.
- **R12, quota race.** Closed for the active and daily Agent Run limits.
  Reproduced against a real database first: six concurrent requests against a
  limit of two created six active Runs, because the route counted, decided, and
  then inserted with nothing held in between. The 3-per-60s start rate limit
  bounds how fast the race can be attempted and does not close it.
  `claim_agent_run_slot` (migration 016) counts and inserts in one transaction
  under a per-user advisory lock, following `acquire_agent_provider_lease`. Same
  fixtures after the change: 6 concurrent requests produce 2 Runs, 25 concurrent
  requests produce 2, and the daily limit produces exactly its cap under 8
  concurrent attempts. The in-application check is kept as an advisory fast path
  and is documented as such, so the two cannot be mistaken for one decision.
  Idempotency (a caller retrying the same logical request) is still open and is a
  different property from the count race.
- **R12, provider capacity.** `POST /api/agent/runs/[id]/cancel` always frees the
  caller's own active slot, but releases the deployment-wide provider lease only
  when the durable workflow is provably terminal or not executing. When the
  workflow row still reads `running` while its invocation has actually died, the
  lease is left to expire on its own, so `max_concurrent = 1` can still block
  Agent Runs for up to an hour. Releasing it earlier would be worse: cancellation
  records an event rather than forcing a running function to exit, so freeing
  capacity while the original execution may still hold provider and sandbox
  resources over-subscribes a limit sized for one. Closing this needs a staleness
  proof, such as a heartbeat or a reconciliation reaper, not a change to the route.
- **R13.** Closed on both ingress paths. `/api/v1/locate` records task shape
  only, and `/api/track` now filters client properties against a per-event
  schema (`src/lib/analytics-events.ts`) that accepts numbers and fixed
  enumerations and drops every undeclared key. Two allowed events,
  `task_analyzed` and `project_saved`, have no producer and therefore declare no
  properties: declare them before relying on any value being recorded, because
  an undeclared key is dropped rather than stored.
- **R14.** The model allowlist applies a conservative default chosen in the
  absence of a stated policy: only models already referenced by this repository
  are approved. Widening it is a product decision and a one-line change in
  `ALLOWED_AGENT_MODELS`.

## Suggested order

1. **One live Run against the isolated verification path.** The implementation
   landed; what is owed is confirmation that a second sandbox, `deny-all` on it,
   and materialization at real candidate size behave as expected on the
   deployment target. Until then the property is implemented, not proven.
2. **R9 process isolation**, once there is a way to verify worker behaviour on
   the deployment target.
3. **R7 least-privilege database role**, replacing the service role rather than
   only removing its default failure mode.
4. **R4**, in the same change that enables delivery, and not before.

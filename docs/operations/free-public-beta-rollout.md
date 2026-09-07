# Free public beta rollout

## Boundary

The hosted beta offers one shared Cloudflare Workers AI Run per UTC day across
Locus, capped at 100,000 total model tokens. A signed-in user may instead
connect their own reviewed Cloudflare credential. This is a capacity-limited
beta, not an unlimited free service.

External writes, private Repos, billing, silent model fallback, and arbitrary
BYOK providers remain disabled.

## Required production configuration

Keep `LOCUS_SELF_SERVE` empty while preparing the release. Production must
contain these variables by name without printing their values:

- `LOCUS_AGENT_MODEL=@cf/qwen/qwen3.8-27b`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `LOCUS_CREDENTIAL_ENCRYPTION_KEY`
- the existing Clerk, Supabase, retention, and alerting variables

Create the shared token from Cloudflare Workers AI's **Use REST API** flow. A
custom token needs only Workers AI Read and Workers AI Edit for the shared
account. Generate an independent encryption key with `openssl rand -base64 32`.
Do not reuse or print any existing secret, and never paste a value into an
issue, commit, chat, Run, or deployment log.

## Database and deploy order

1. Confirm new Run admission is closed: keep `LOCUS_SELF_SERVE` empty and put
   only the canary operator in `ALPHA_ALLOWED_USER_IDS`.
2. From a clean checkout matching the release SHA, run the full preflight in
   `public-early-access-rollout.md`, including `pnpm check:merge-markers`.
3. In the Supabase web dashboard, open **Database > Migrations** and confirm
   migrations `001` through `020` are applied in order. If `018`, `019`, or
   `020` is pending, compare it with the reviewed file under
   `supabase/migrations` and apply it from the dashboard. Then run both
   **Database > Advisors** checks. Browser roles must have no access to
   `agent_provider_credentials` or `agent_provider_daily_claims`.
4. Install the four production variables above and deploy the reviewed SHA.
5. Confirm `/api/health` returns `status: "ok"`, the reviewed revision, no
   missing readiness fields, and a configured alerting mode.

> **Rollback is not free here.** Migration `020` drops the provider default on
> `agent_runs` and removes the seven-argument `claim_agent_run_slot` used by
> pre-`020` applications. Never promote a pre-`020` application against this
> schema. Use a known-good deployment that already understands `020`, or apply
> a separately reviewed database rollback with the application rollback.

## Frozen canary

Keep `LOCUS_SELF_SERVE` empty and put exactly one operator Clerk user ID in
`ALPHA_ALLOWED_USER_IDS`.

1. Save and remove a test Cloudflare connection in Settings. The API response,
   browser storage, logs, Steps, and Artifacts must contain no token.
2. Save the connection again and run one BYOK Agent Task. Its Run must reach
   Review-ready, use `provider=cloudflare-workers-ai`, use
   `execution_mode=byok`, pass isolated Checks, and create no external write.
3. Start one shared Run after 00:00 UTC. It must reach Review-ready against the
   same frozen model and create one `agent_provider_daily_claims` row for that
   UTC day.
4. A second shared start must return `429` with `Retry-After` pointing to the
   next UTC reset. A BYOK Run must remain independently admissible.
5. Review the proposal against every frozen criterion, verify the immutable
   proposal hash, and confirm provider capacity enters cooldown. Only an
   explicit Review may complete the Run; Review never authorizes an external
   write.

The shared canary consumes that day's free slot. Open self-serve admission at
the next UTC reset, not immediately after the canary.

## Open and monitor

Clear `ALPHA_ALLOWED_USER_IDS`, set `LOCUS_SELF_SERVE=open`, set a conservative
`LOCUS_SELF_SERVE_MAX_ACCOUNTS`, and deploy the same SHA. Verify the workspace
explains the shared daily boundary before a user starts and links an
unconnected BYOK user to Settings.

Monitor Cloudflare neurons, provider `429` responses, Run failure kinds,
provider leases, daily claims, Sandbox usage, health probes, and
credential-route errors. Never log account IDs in full or any API token.

## Rollback

1. Clear `LOCUS_SELF_SERVE` and `ALPHA_ALLOWED_USER_IDS`, then redeploy. Verify
   `/api/health` reports `readiness.admission: "invite_only"`. Existing
   evidence remains readable.
2. Revoke the shared Cloudflare token if provider authentication or credential
   handling is in doubt. Rotate the encryption key only with a credential
   migration plan; changing it immediately makes saved BYOK tokens unreadable.
3. Promote only a known-good application revision compatible with migration
   `020`, or revert through a new reviewed PR.
4. Verify health, sign-in, public localization, Run history, and logs before
   declaring recovery.

# Public early-access rollout

## Ownership and scope

The release operator owns launch, incident response, and rollback until another owner is recorded. The public surface is account creation, public-Repo localization, and a clearly capped Agent Run beta. Private Repo access and external delivery remain closed.

The production application, Supabase project, Clerk application, Vercel project, GitHub repository, and model provider are the systems in scope. Do not widen access to billing, teams, private Repos, or external delivery as part of this rollout.

## Preflight

From a clean `main` checkout that matches `origin/main`:

```bash
git diff --check
git diff --quiet
git diff --cached --quiet
pnpm lint
pnpm test
pnpm typecheck
pnpm check:merge-markers
pnpm check:alpha-claims
pnpm evidence:release1
pnpm check-sync
pnpm build
pnpm audit --audit-level high
```

The Release 1 evaluation is allowed to remain in `collecting` state for this public localization launch. It blocks unrestricted Agent Runs and Savings claims, not self-serve localization.

Verify the production database from the Supabase web dashboard. Open the
project's **Database > Migrations** page and confirm the applied chain is exactly
`001`–`020`. Compare each pending migration with the reviewed file in
`supabase/migrations` before applying it from the dashboard; do not paste an
unreviewed directory or run migrations in a shell loop. Then open
**Database > Advisors**, run both Security and Performance checks, and retain a
dated screenshot or dashboard link. There must be no pending migration and no
unresolved Security finding before admission opens.

## Monitoring contract

Production must set either an HTTPS `OPS_ALERT_WEBHOOK_URL` or `OPS_EXTERNAL_HEALTHCHECK=github_actions`. Without one, `/api/health` fails closed with `missing: ["alerting"]`.

The `.github/workflows/production-health.yml` monitor runs every five minutes and checks health, readiness, and alerting mode. Scheduled probes intentionally do not compare production to the latest `main` SHA because Vercel promotion can lag a merge. Repository owners must keep GitHub Actions failure notifications enabled. Vercel error-anomaly and usage-anomaly rules provide a second signal.

Before launch, dispatch the workflow with `expected_revision` set to the deployed seven-character SHA, then once more with the same revision and `test_alert=true`. The normal run must pass. The intentional test must fail after the healthy probe and appear in the configured GitHub notification channel; record the run URL, then rerun normally.

## Production verification

```bash
export PRODUCTION_URL=https://locus-five-iota.vercel.app
export RELEASE_SHA="$(git rev-parse HEAD)"
curl --fail-with-body "$PRODUCTION_URL/api/health" | jq -e \
  --arg revision "${RELEASE_SHA:0:7}" \
  '.status == "ok"
    and .revision == $revision
    and .readiness.missing == []
    and (.readiness.alerting == "webhook" or .readiness.alerting == "external_health_check")'
```

Verify `/`, `/docs`, `/pricing`, `/privacy`, `/support`, `/terms`, `/sign-in`, and `/workspace` at a mobile viewport. There must be no console errors, CSP violations, horizontal overflow, or broken authentication redirect. Open and close the Agent Run access dialog with the keyboard.

## Rollback

1. Clear both `ALPHA_ALLOWED_USER_IDS` and `LOCUS_SELF_SERVE`, then redeploy, if Agent Run behavior or provider capacity is in question. Verify `/api/health` reports `readiness.admission: "invite_only"`; clearing only the allowlist stops the invited partners and leaves every self-serve account running.
2. Promote a known-good Vercel deployment that already understands migration `020`, or revert the launch PR through a new reviewed PR. Do not promote a pre-`020` application against the current schema.
3. Leave migrations `001`–`020` installed. Migrations `018`–`019` are additive; migration `020` changes the provider claim contract and must remain paired with a compatible application revision.
4. Verify `/api/health`, the production monitor, sign-in, public localization, and logs before declaring recovery.
5. Follow `docs/operations/incident-response.md` for security, data-integrity, or evidence concerns.

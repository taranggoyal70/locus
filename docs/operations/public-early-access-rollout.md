# Public early-access rollout

## Ownership and scope

The release operator owns launch, incident response, and rollback until another owner is recorded. The public surface is account creation plus public-Repo localization. Agent Runs remain an explicitly separate, invite-gated capability.

The production application, Supabase project, Clerk application, Vercel project, GitHub repository, and model provider are the systems in scope. Do not widen access to billing, teams, private Repos, or external delivery as part of this rollout.

## Preflight

From a clean `main` checkout that matches `origin/main`:

```bash
git diff --check
git diff --quiet
git diff --cached --quiet
pnpm lint
pnpm test
pnpm tsc --noEmit
pnpm check:alpha-claims
pnpm evidence:release1
pnpm check-sync
pnpm build
pnpm audit --audit-level high
```

The Release 1 evaluation is allowed to remain in `collecting` state for this public localization launch. It blocks unrestricted Agent Runs and Savings claims, not self-serve localization.

Verify production database history and advisors:

```bash
pnpm dlx supabase@2.111.0 migration list --linked
pnpm dlx supabase@2.111.0 db push --linked --dry-run
pnpm dlx supabase@2.111.0 db advisors --linked
```

The chain must be exactly `001`–`017`, the dry run must be empty, and advisors must return no findings.

## Monitoring contract

Production must set either an HTTPS `OPS_ALERT_WEBHOOK_URL` or `OPS_EXTERNAL_HEALTHCHECK=github_actions`. Without one, `/api/health` fails closed with `missing: ["alerting"]`.

The `.github/workflows/production-health.yml` monitor runs every five minutes and checks health, readiness, alerting mode, and the deployed `main` revision. Repository owners must keep GitHub Actions failure notifications enabled. Vercel error-anomaly and usage-anomaly rules provide a second signal.

Before launch, dispatch the workflow normally and once with `test_alert=true`. The normal run must pass. The intentional test must fail after the healthy probe and appear in the configured GitHub notification channel; record the run URL, then rerun normally.

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

1. Clear `ALPHA_ALLOWED_USER_IDS` and redeploy if Agent Run behavior or provider capacity is in question.
2. Promote the previous known-good Vercel production deployment or revert the launch PR through a new reviewed PR.
3. Leave migrations `001`–`017` installed; they are additive and already serve the prior application.
4. Verify `/api/health`, the production monitor, sign-in, public localization, and logs before declaring recovery.
5. Follow `docs/operations/incident-response.md` for security, data-integrity, or evidence concerns.

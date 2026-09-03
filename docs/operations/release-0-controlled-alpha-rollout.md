# Release 0 controlled-alpha rollout

This runbook promotes the reviewed `main` commit and Supabase migrations through
`011`. It is intentionally fail-closed: stop if the linked project, migration
history, destructive-secret count, or dry-run output is not exactly understood.

## Preflight

Record immutable release evidence:

```bash
export RELEASE_SHA="$(git rev-parse HEAD)"
test "$(git branch --show-current)" = main
test -z "$(git status --porcelain | grep -v '^?? supabase/.temp/' || true)"
export SUPABASE_CLI_VERSION=2.111.0
test "$(pnpm dlx supabase@${SUPABASE_CLI_VERSION} --version)" = "$SUPABASE_CLI_VERSION"
shasum -a 256 supabase/migrations/0{04,05,06,07,08,09,10,11}_*.sql
pnpm lint
pnpm test
pnpm check:alpha-claims
pnpm check-sync
pnpm tsc --noEmit
pnpm build
```

Pin and assert the production project reference before inspecting history:

```bash
: "${EXPECTED_SUPABASE_PROJECT_REF:?Set the reviewed production project ref}"
: "${SUPABASE_ACCESS_TOKEN:?Set a short-lived Supabase CLI access token}"
test -f supabase/.temp/project-ref
ACTUAL_SUPABASE_PROJECT_REF="$(tr -d '[:space:]' < supabase/.temp/project-ref)"
test "$ACTUAL_SUPABASE_PROJECT_REF" = "$EXPECTED_SUPABASE_PROJECT_REF"
```

Then inspect
history and the exact apply set without changing it:

```bash
pnpm dlx supabase@${SUPABASE_CLI_VERSION} migration list --linked
pnpm dlx supabase@${SUPABASE_CLI_VERSION} db push --linked --dry-run
```

The remote history must be a contiguous prefix of local migrations `001`–`011`.
The dry run must contain only the remaining contiguous suffix. Stop on a remote-
only version, a gap, a repaired version, or any file outside `004`–`011`.

Run these read-only production queries and retain the results:

```sql
select current_database(), current_user, version();

select version, name
from supabase_migrations.schema_migrations
order by version;

select to_regclass(name) as object
from unnest(array[
  'public.events',
  'public.waitlist',
  'public.agent_tasks',
  'public.agent_runs',
  'public.agent_steps',
  'public.agent_artifacts',
  'public.agent_approvals',
  'public.github_connections'
]) as name;

select count(*) as github_connections_to_delete
from public.github_connections;

select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'agent_runs'
order by ordinal_position;

select relname, relrowsecurity
from pg_class
where oid in ('public.events'::regclass, 'public.waitlist'::regclass);

select role_name, table_name, privilege_name,
  has_table_privilege(role_name, format('public.%I', table_name), privilege_name)
from (values ('anon'), ('authenticated')) roles(role_name)
cross join (values ('events'), ('waitlist')) tables(table_name)
cross join (values ('INSERT'), ('UPDATE'), ('DELETE')) privileges(privilege_name)
order by table_name, role_name, privilege_name;
```

Before apply, production must also have server-only
`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, Clerk keys, and a
non-empty `ALPHA_ALLOWED_USER_IDS` containing only approved design partners.
It must also have an Agent provider configured. The controlled-alpha
configuration is `LOCUS_AGENT_MODEL=openai/gpt-5.6-sol`, routed through Vercel
AI Gateway with the deployment's short-lived OIDC credential. No direct
provider credential is installed. Agent calls request the Gateway's
no-prompt-training policy. The alpha remains restricted to public Repos and
must never receive private, confidential, or personal Repo or task data. The
start UI requires an unchecked acknowledgement, and the API rejects a request
without it. Review the current [Gateway catalog and
pricing](https://vercel.com/ai-gateway/models), [Vercel AI product
terms](https://vercel.com/legal/ai-product-terms), and [OpenAI business-data
policy](https://openai.com/business-data/) before every promotion.

Install the exact reviewed model configuration. These commands replace a stale
value without printing it; the current deployment does not observe the change
until it is redeployed.

```bash
: "${EXPECTED_VERCEL_PROJECT_ID:?Set the reviewed Vercel project ID}"
: "${EXPECTED_VERCEL_ORG_ID:?Set the reviewed Vercel organization ID}"
export EXPECTED_VERCEL_PROJECT_ID EXPECTED_VERCEL_ORG_ID
node -e '
  const linked = require("./.vercel/project.json");
  if (linked.projectId !== process.env.EXPECTED_VERCEL_PROJECT_ID
    || linked.orgId !== process.env.EXPECTED_VERCEL_ORG_ID) process.exit(1);
'
vercel env add LOCUS_AGENT_MODEL production \
  --value 'openai/gpt-5.6-sol' --no-sensitive --force --yes \
  --project "$EXPECTED_VERCEL_PROJECT_ID" --scope "$EXPECTED_VERCEL_ORG_ID"
```

Do not print environment values into rollout logs.

```bash
for required_name in \
  NEXT_PUBLIC_SUPABASE_URL \
  SUPABASE_SERVICE_ROLE_KEY \
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY \
  CLERK_SECRET_KEY \
  ALPHA_ALLOWED_USER_IDS \
  LOCUS_AGENT_MODEL; do
  vercel env ls production \
    --project "$EXPECTED_VERCEL_PROJECT_ID" \
    --scope "$EXPECTED_VERCEL_ORG_ID" \
    | grep -Eq "(^|[[:space:]])${required_name}([[:space:]]|$)"
done
```

## Safe apply

Pause production deploys. Keep the app on the prior commit while the additive
schema is installed. Apply the exact suffix shown by the dry run:

```bash
test "$(tr -d '[:space:]' < supabase/.temp/project-ref)" = "$EXPECTED_SUPABASE_PROJECT_REF"
pnpm dlx supabase@${SUPABASE_CLI_VERSION} db push --linked
pnpm dlx supabase@${SUPABASE_CLI_VERSION} migration list --linked
```

Migrations `004`–`010` are transactional schema/security changes. Migration
`011` permanently deletes stored legacy GitHub OAuth tokens because private
repository reads are disabled. The preflight row count is the deletion record.

After the database verifies, push the reviewed `main` commit and let Vercel
deploy that SHA. Do not enable GitHub delivery, Teams, Billing, private Repo
reads, or savings claims.

## Post-migration verification

```sql
select version, name
from supabase_migrations.schema_migrations
where version between '004' and '011'
order by version;

select to_regclass('public.api_rate_limits') as rate_limit_table,
  to_regprocedure(
    'public.consume_api_rate_limit(text,integer,integer)'
  ) as rate_limit_function;

select c.relrowsecurity as rls_enabled,
  has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE') as anon_access,
  has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE') as authenticated_access
from pg_class c
where c.oid = 'public.api_rate_limits'::regclass;

select
  has_function_privilege(
    'service_role',
    'public.consume_api_rate_limit(text,integer,integer)',
    'EXECUTE'
  ) as service_role_execute,
  has_function_privilege(
    'anon',
    'public.consume_api_rate_limit(text,integer,integer)',
    'EXECUTE'
  ) as anon_execute,
  has_function_privilege(
    'authenticated',
    'public.consume_api_rate_limit(text,integer,integer)',
    'EXECUTE'
  ) as authenticated_execute;

select *
from public.consume_api_rate_limit(
  'rollout-verification:' || txid_current(),
  1,
  60
);

select count(*) as remaining_legacy_github_tokens
from public.github_connections;
```

Required results: migrations `004`–`011` are present once; the rate-limit table
has RLS; public roles have no table access or function execution; `service_role`
can execute the function; the canary returns `allowed = true`; and the legacy
GitHub connection count is zero.

Verify application behavior at the deployed SHA:

```bash
curl --fail-with-body "$PRODUCTION_URL/api/health"
curl -i -X POST "$PRODUCTION_URL/api/waitlist" \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://attacker.example' \
  --data '{"email":"blocked@example.invalid"}'
```

The health route must return `200`; the cross-origin canary must return `403`
and must not create a row. With controlled accounts, confirm an outside-alpha
Agent start returns `403`, an invited start returns `202`, reaches a quiescent
review state, displays every Included/Excluded/Widened path, and creates no
external GitHub write.

## Rollback boundaries

- Roll back application code first if the new deployment fails. Migration
  `010` is additive and can remain safely in place.
- Drop `consume_api_rate_limit` and `api_rate_limits` only after every deployed
  caller has been rolled back. Doing so first makes protected routes fail
  closed with `503`.
- Do not reverse migration `004`; restoring public writes is a security
  regression.
- Do not destructively roll back migrations `005`–`009` after Runs exist.
  Fix forward, or close admission by clearing both `ALPHA_ALLOWED_USER_IDS` and `LOCUS_SELF_SERVE`.
- Migration `011` is irreversible by design. Deleted OAuth tokens must never be
  restored from logs or backups; users must re-authorize when private Repo
  support is separately released.

## Public-beta promotion checklist

- [ ] Two design-partner proposals reach review-ready state and are human-accepted against explicit acceptance criteria.
- [ ] Each Run exposes complete Included, Excluded, and Widened file evidence.
- [ ] Paired whole-Repo baselines exist before any savings claim is enabled.
- [ ] Failure, timeout, truncation, and review-ready states are understandable.
- [ ] Abuse limits, error alerts, workflow failures, and cost are monitored.
- [ ] Public/private Repo and external-write boundaries match UI and docs.
- [ ] Privacy, terms, retention, support, incident owner, and rollback owner are current.
- [ ] Mobile and desktop critical paths pass production browser verification.
- [ ] `main`, required CI checks, and deployment environments are protected.
- [ ] Billing, Teams, private Repo reads, delivery, and savings claims remain off
      until their separate release gates pass.

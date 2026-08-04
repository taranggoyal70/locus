# Release 1 readiness rollout

This package installs migrations `012`–`014`, deploys the reviewed application SHA, and gathers the evidence required to decide whether Release 1 may begin. It does not turn missing human acceptance or elapsed canary time into a pass.

## Exact preflight

Freeze the release identity and verify the checkout. The known launch-video working files and `supabase/.temp/` are not release inputs and must not be staged.

```bash
set -euo pipefail
export RELEASE_SHA="$(git rev-parse HEAD)"
test "$(git branch --show-current)" = main
test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)"
git diff --check
git diff --quiet -- . ':!launch/locus-linkedin-video/**'
git diff --cached --quiet
shasum -a 256 supabase/migrations/0{12,13,14}_*.sql
pnpm lint
pnpm test
pnpm check:alpha-claims
pnpm check-sync
pnpm tsc --noEmit
pnpm build
pnpm audit --prod --audit-level high
```

Pin the production identities and CLI version. Stop on any mismatch.

```bash
: "${EXPECTED_SUPABASE_PROJECT_REF:?}"
: "${SUPABASE_ACCESS_TOKEN:?Use a short-lived token}"
: "${EXPECTED_VERCEL_PROJECT_ID:?}"
: "${EXPECTED_VERCEL_ORG_ID:?}"
export SUPABASE_CLI_VERSION=2.111.0
test "$(pnpm dlx supabase@${SUPABASE_CLI_VERSION} --version)" = "$SUPABASE_CLI_VERSION"
test "$(tr -d '[:space:]' < supabase/.temp/project-ref)" = "$EXPECTED_SUPABASE_PROJECT_REF"
node -e '
  const linked = require("./.vercel/project.json");
  if (linked.projectId !== process.env.EXPECTED_VERCEL_PROJECT_ID
    || linked.orgId !== process.env.EXPECTED_VERCEL_ORG_ID) process.exit(1);
'
pnpm dlx supabase@${SUPABASE_CLI_VERSION} migration list --linked
pnpm dlx supabase@${SUPABASE_CLI_VERSION} db push --linked --dry-run
```

Remote migration history must be the exact contiguous prefix `001`–`011`. The dry run must contain only `012_release1_run_evidence.sql`, `013_agent_provider_capacity.sql`, and `014_agent_data_retention.sql`, in that order. Stop on a gap, remote-only migration, repair marker, or additional file.

Run and retain these read-only production checks:

```sql
select current_database(), current_user, version();

select version, name
from supabase_migrations.schema_migrations
order by version;

select status, count(*)
from public.agent_runs
group by status
order by status;

select run_id, kind, count(*)
from public.agent_artifacts
where kind in ('change_set', 'diff', 'summary')
group by run_id, kind
having count(*) > 1;

select count(*) as active_runs
from public.agent_runs
where status in ('queued', 'localizing', 'planning', 'executing', 'verifying');

select
  to_regprocedure('extensions.digest(bytea,text)') as digest_function,
  to_regclass('public.agent_runs') as runs,
  to_regclass('public.agent_artifacts') as artifacts;
```

Required results: no duplicate proposal artifact kinds, zero active Runs, and a non-null SHA-256 digest function. Temporarily clear `ALPHA_ALLOWED_USER_IDS` and deploy that environment-only change before applying migrations so no Run can start during the window.

Confirm these production variables by name without printing values: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, Clerk keys, `LOCUS_AGENT_MODEL`, `GOOGLE_GENERATIVE_AI_API_KEY`, `ALPHA_ALLOWED_USER_IDS`, `CRON_SECRET`, and `OPS_ALERT_WEBHOOK_URL`. `LOCUS_RUN_TOKEN_BUDGET` may be omitted for the safe 180,000 default or must parse to 10,000–240,000. The Release 1 evaluation contract freezes 180,000.

## Safe apply

Keep the prior application revision serving traffic with Run admission disabled. Apply the exact dry-run suffix once:

```bash
test "$(tr -d '[:space:]' < supabase/.temp/project-ref)" = "$EXPECTED_SUPABASE_PROJECT_REF"
pnpm dlx supabase@${SUPABASE_CLI_VERSION} db push --linked
pnpm dlx supabase@${SUPABASE_CLI_VERSION} migration list --linked
```

Do not use `--include-all`, repair history, or run an untracked file loop. After database verification succeeds, deploy exactly `$RELEASE_SHA` to Vercel production. Keep admission disabled until application verification passes.

## Post-migration verification queries

```sql
select version, name
from supabase_migrations.schema_migrations
where version between '012' and '014'
order by version;

select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('agent_runs', 'agent_artifacts', 'agent_reviews', 'agent_provider_leases')
order by table_name, ordinal_position;

select
  to_regprocedure('public.publish_agent_proposal(uuid,text,text,text,text,text,jsonb,jsonb,integer,integer,integer,integer,text[],text[])') as publish_rpc,
  to_regprocedure('public.decide_agent_proposal(uuid,text,text,text,jsonb,text)') as review_rpc,
  to_regprocedure('public.acquire_agent_provider_lease(uuid,text,integer,integer)') as acquire_rpc,
  to_regprocedure('public.release_agent_provider_lease(uuid,integer)') as release_rpc,
  to_regprocedure('public.delete_expired_agent_data(integer)') as retention_rpc;

select c.relname, c.relrowsecurity,
  has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE') as anon_access,
  has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE') as authenticated_access
from pg_class c
where c.oid in (
  'public.agent_reviews'::regclass,
  'public.agent_provider_leases'::regclass
)
order by c.relname;

select p.oid::regprocedure as routine,
  p.prosecdef as security_definer,
  has_function_privilege('service_role', p.oid, 'EXECUTE') as service_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'publish_agent_proposal',
    'decide_agent_proposal',
    'acquire_agent_provider_lease',
    'release_agent_provider_lease',
    'delete_expired_agent_data'
  )
order by routine;

select tgname, tgrelid::regclass, tgenabled
from pg_trigger
where not tgisinternal
  and tgname in ('immutable_published_agent_artifacts', 'immutable_agent_reviews')
order by tgname;
```

Required results: migrations `012`–`014` appear once; every object resolves; both new tables have RLS; browser roles have no effective access or RPC execution; `service_role` can execute every RPC; both immutability triggers are enabled.

Run the following transactional canary from an administrative SQL session. It creates no durable rows:

```sql
begin;

insert into public.agent_tasks (id, user_id, repo_url, base_ref, task, acceptance_criteria)
values (
  '00000000-0000-4000-8000-000000000101',
  'release1-rollout-canary',
  'https://github.com/taranggoyal70/locus',
  'main',
  'Verify Release 1 evidence transaction',
  array['Proposal is atomically published']
);

insert into public.agent_runs (id, task_id, user_id, status, model, token_budget)
values (
  '00000000-0000-4000-8000-000000000102',
  '00000000-0000-4000-8000-000000000101',
  'release1-rollout-canary',
  'executing',
  'google/gemini-3.5-flash',
  180000
);

select * from public.publish_agent_proposal(
  '00000000-0000-4000-8000-000000000102',
  'release1-rollout-canary',
  '0123456789abcdef0123456789abcdef01234567',
  '{"version":1,"baseCommitSha":"0123456789abcdef0123456789abcdef01234567","files":[{"path":"README.md","operation":"update","content":"canary"}]}'::text,
  'diff --git a/README.md b/README.md'::text,
  'Release 1 transaction canary'::text,
  '{"changedFiles":["README.md"]}'::jsonb,
  '{"checks":[{"command":"canary","exitCode":0}]}'::jsonb,
  100, 120, 0, 10, '{}', '{}'
);

select status, proposal_hash, input_tokens, output_tokens
from public.agent_runs
where id = '00000000-0000-4000-8000-000000000102';

select kind, content_sha256, base_revision
from public.agent_artifacts
where run_id = '00000000-0000-4000-8000-000000000102'
order by kind;

select * from public.decide_agent_proposal(
  '00000000-0000-4000-8000-000000000102',
  'release1-rollout-canary',
  (select proposal_hash from public.agent_runs where id = '00000000-0000-4000-8000-000000000102'),
  'accepted',
  '[{"criterion":"Proposal is atomically published","satisfied":true,"evidence":"transaction canary"}]'::jsonb,
  'rollout canary'
);

select status, completed_at
from public.agent_runs
where id = '00000000-0000-4000-8000-000000000102';

select * from public.acquire_agent_provider_lease(
  '00000000-0000-4000-8000-000000000102',
  'google/gemini-3.5-flash',
  1,
  60
);
select public.release_agent_provider_lease(
  '00000000-0000-4000-8000-000000000102',
  60
);

rollback;
```

The publish call must return one 64-character hash; the Run must become `awaiting_approval` with exactly three hashed proposal artifacts; the review must bind the same hash and end `completed`; lease acquisition/release must return true; rollback must leave zero canary rows.

## Application verification and staged admission

```bash
: "${PRODUCTION_URL:?}"
: "${RELEASE_SHA:?}"
curl --fail-with-body "$PRODUCTION_URL/api/health" | jq -e \
  --arg revision "${RELEASE_SHA:0:7}" '.status == "ok" and .revision == $revision'
curl -i -X POST "$PRODUCTION_URL/api/agent/runs" \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://attacker.example' \
  --data '{}'
```

The cross-origin request must be denied and create no task or Run. Restore exactly one approved design partner to `ALPHA_ALLOWED_USER_IDS`, redeploy the same SHA, and run one public-repository canary. It must remain within 180,000 tokens, reach review-ready through the atomic RPC, expose Included/Excluded/Widened files, pass required Checks, accept or reject against every frozen criterion, create no external GitHub write, emit the expected structured events, and release provider capacity into cooldown.

## Rollback boundaries

- Roll application code back first and clear `ALPHA_ALLOWED_USER_IDS`. Migrations `012`–`014` are additive and safe to leave installed for the previous application.
- Do not drop proposal hashes, reviews, artifacts, or immutability triggers after any Release 1 Run exists. Fix forward.
- Do not drop provider-lease RPCs while a Release 1 caller is deployed. Old leases expire automatically; manual deletion is safe only after admission is disabled and active Runs are zero.
- Do not call the retention RPC as a rollback. Deleted data is intentionally unrecoverable from the application; provider backups have separate lifetimes.
- Reversing RLS/revokes or restoring public writes is never an acceptable rollback.
- If the review RPC is defective, disable admission and review, preserve existing evidence, deploy a fix, and retry with a new Run rather than rewriting a published proposal.

## Release 1 decision checklist

- [ ] Database preflight, dry run, checksums, apply, privilege checks, and transactional canary are retained as evidence.
- [ ] Production revision, health, origin denial, retention authentication, and alert delivery pass.
- [ ] Frozen `release1-v1` evaluation contains all 40 arm results and `pnpm eval:release1` passes without exclusions.
- [ ] Two distinct design-partner Runs are human-accepted with criterion-level, artifact-bound review evidence.
- [ ] A 24–48 hour one-partner canary has no Critical incident, unexplained quota failure, evidence mutation, or external write.
- [ ] Desktop and mobile critical paths, keyboard operation, AA accessibility, and agreed performance budgets pass in production.
- [ ] Privacy, 30/90-day retention, terms, support, security advisory, incident lead, alert channel, and rollback owner are verified.
- [ ] `main` enforces required CI, administrator protection, pull requests, conversation resolution, and no force-push/deletion.
- [ ] Production deployment promotion is restricted to the reviewed `main` SHA.
- [ ] Savings copy remains disabled until the paired total-token gate passes; billing, private repositories, and external delivery remain separate releases.

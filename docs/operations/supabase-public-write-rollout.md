# Supabase public-write rollout

Migration `004_harden_public_writes.sql` removes direct write privileges from
`anon` and `authenticated` on `public.events` and `public.waitlist`. The
application continues to insert through its server-only `service_role` key.

Apply this migration before promoting the public beta. Use one operator, record
all command output in the change ticket, and do not combine this rollout with
unrelated schema changes.

## Release identity

Verify that the checkout and migration are the reviewed versions:

```bash
: "${APPROVED_RELEASE_SHA:?Set this from the approved PR}"
: "${APPROVED_MIGRATION_SHA256:?Set this from the approved PR artifact}"

test "$(git rev-parse HEAD)" = "$APPROVED_RELEASE_SHA"
test -z "$(git status --porcelain)"
test "$(
  git show HEAD:supabase/migrations/004_harden_public_writes.sql \
    | shasum -a 256 \
    | awk '{print $1}'
)" = "$APPROVED_MIGRATION_SHA256"
```

The release approver must record both expected values from the final PR artifact
before the operator starts.

## Preflight

Confirm the linked Supabase project is production, then inspect migration
history without making changes:

```bash
supabase migration list --linked
supabase db push --linked --dry-run
```

The remote must contain migrations `001`, `002`, and `003`, with only `004`
pending. Stop if history is missing or divergent. Do not use `--include-all`,
replay the full migration directory, or repair history until the live schema has
been inspected.

Run the following read-only queries against production:

```sql
select
  current_database() as database_name,
  current_user as migration_user,
  current_setting('search_path') as search_path,
  version() as postgres_version;

select
  to_regclass('public.events') as events_table,
  to_regclass('public.waitlist') as waitlist_table,
  to_regclass('supabase_migrations.schema_migrations') as migration_history;

select tablename, tableowner
from pg_tables
where schemaname = 'public'
  and tablename in ('events', 'waitlist')
order by tablename;

select
  t.tablename,
  t.tableowner,
  current_user = t.tableowner
    or coalesce(r.rolsuper, false) as can_alter_as_current_user
from pg_tables t
left join pg_roles r on r.rolname = current_user
where t.schemaname = 'public'
  and t.tablename in ('events', 'waitlist')
order by t.tablename;

select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('events', 'waitlist')
order by c.relname;

select
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('events', 'waitlist')
order by tablename, policyname;

with roles(role_name) as (
  values ('anon'), ('authenticated')
),
tables(table_name) as (
  values ('events'), ('waitlist')
),
privileges(privilege_name) as (
  values
    ('INSERT'),
    ('UPDATE'),
    ('DELETE'),
    ('TRUNCATE'),
    ('REFERENCES'),
    ('TRIGGER')
)
select
  role_name,
  table_name,
  privilege_name,
  has_table_privilege(
    role_name,
    format('public.%I', table_name),
    privilege_name
  ) as effective_privilege
from roles cross join tables cross join privileges
order by table_name, role_name, privilege_name;

select
  table_name,
  has_table_privilege(
    'service_role',
    format('public.%I', table_name),
    'INSERT'
  ) as service_role_insert
from (values ('events'), ('waitlist')) as tables(table_name)
order by table_name;

select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('events', 'waitlist')
  and privilege_type in (
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'REFERENCES',
    'TRIGGER'
  )
order by table_name, grantee;

select
  p.oid::regprocedure as routine,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  has_function_privilege(
    'authenticated',
    p.oid,
    'EXECUTE'
  ) as authenticated_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind = 'f'
  and (
    p.prosecdef
    or has_function_privilege('anon', p.oid, 'EXECUTE')
    or has_function_privilege('authenticated', p.oid, 'EXECUTE')
  )
order by routine;

select
  v.table_name,
  v.view_definition,
  v.is_updatable,
  v.is_insertable_into,
  has_table_privilege(
    'anon',
    format('public.%I', v.table_name),
    'INSERT'
  ) as anon_insert,
  has_table_privilege(
    'authenticated',
    format('public.%I', v.table_name),
    'INSERT'
  ) as authenticated_insert,
  has_table_privilege(
    'anon',
    format('public.%I', v.table_name),
    'UPDATE'
  ) as anon_update,
  has_table_privilege(
    'authenticated',
    format('public.%I', v.table_name),
    'UPDATE'
  ) as authenticated_update,
  has_table_privilege(
    'anon',
    format('public.%I', v.table_name),
    'DELETE'
  ) as anon_delete,
  has_table_privilege(
    'authenticated',
    format('public.%I', v.table_name),
    'DELETE'
  ) as authenticated_delete
from information_schema.views v
where v.table_schema = 'public'
  and (
    v.is_updatable = 'YES'
    or v.is_insertable_into = 'YES'
  )
order by v.table_name;
```

All preflight gates must pass:

- Both tables exist and have RLS enabled.
- `can_alter_as_current_user` is true for both tables.
- `service_role` has effective `INSERT` on both tables.
- Public API roles have no unexpected write privilege or permissive write
  policy.
- Every publicly executable or `SECURITY DEFINER` routine and every updatable
  view is inventoried and reviewed for indirect write paths.
- The release ticket contains deployment-platform evidence that
  `SUPABASE_SERVICE_ROLE_KEY` exists only in the server environment and no
  `NEXT_PUBLIC_*` variable contains its value.

## Apply

When Supabase migration history is healthy, preview once more and apply only the
pending migration:

```bash
supabase db push --linked --dry-run
supabase db push --linked
```

Do not include seed data.

If production is intentionally managed with direct `psql` instead of Supabase
migration history, apply only migration `004` in one transaction:

```bash
psql "$DATABASE_URL" \
  -X \
  -v ON_ERROR_STOP=1 \
  --single-transaction \
  -c "set local search_path = pg_catalog, public; set local lock_timeout = '5s'; set local statement_timeout = '30s';" \
  -f supabase/migrations/004_harden_public_writes.sql
```

Do not mix the two apply workflows. If direct SQL is the established workflow,
update its migration ledger only after the post-migration checks pass.

## Verification

Repeat the RLS, policy, privilege, and routine queries from preflight. Required
postconditions:

- RLS remains enabled on both tables.
- No permissive public `INSERT`, `UPDATE`, `DELETE`, or `ALL` policy remains.
- `anon` and `authenticated` have no effective write privilege.
- `service_role` retains effective `INSERT` on both tables.

Verify the service-role path without retaining canary data:

```sql
begin;

set local role service_role;

insert into public.events (event, properties)
values (
  'migration_004_verification',
  '{"source":"production-rollout"}'::jsonb
);

insert into public.waitlist (email, name)
values (
  'migration-004-' || txid_current() || '@example.invalid',
  'Migration verification'
);

rollback;
```

Each public-role and operation pair below must fail with SQLSTATE `42501`.
Connection, authentication, syntax, and timeout errors fail the verification:

```bash
set -euo pipefail

expect_denied() {
  role="$1"
  statement="$2"
  output="$(
    psql "$DATABASE_URL" \
      -X \
      -v ON_ERROR_STOP=1 \
      -v VERBOSITY=verbose \
      -c "begin; set local role ${role}; ${statement}; rollback;" \
      2>&1
  )" && {
    echo "Unexpected write success for ${role}: ${statement}" >&2
    return 1
  }
  printf '%s\n' "$output" | grep -Eq '42501' || {
    printf '%s\n' "$output" >&2
    echo "Probe failed for a reason other than access denial" >&2
    return 1
  }
}

for role in anon authenticated; do
  active_role="$(
    psql "$DATABASE_URL" \
      -X \
      -Atq \
      -v ON_ERROR_STOP=1 \
      -c "begin; set local role ${role}; select current_user; rollback;"
  )"
  test "$active_role" = "$role"

  expect_denied "$role" \
    "insert into public.events(event) values ('must_fail')"
  expect_denied "$role" \
    "update public.events set event = event where false"
  expect_denied "$role" \
    "delete from public.events where false"
  expect_denied "$role" \
    "insert into public.waitlist(email) values ('must-fail@example.invalid')"
  expect_denied "$role" \
    "update public.waitlist set email = email where false"
  expect_denied "$role" \
    "delete from public.waitlist where false"
done
```

Verify both application write paths with unique correlation values:

```bash
: "${PRODUCTION_URL:?Set the production application URL}"
: "${ROLLOUT_CANARY_EMAIL:?Use a controlled mailbox with a unique plus-address}"
: "${CLERK_SESSION_TOKEN:?Use a short-lived session for the canary account}"

ROLLOUT_ID="migration-004-$(date -u +%Y%m%dT%H%M%SZ)"

curl --fail-with-body \
  -X POST "$PRODUCTION_URL/api/waitlist" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ROLLOUT_CANARY_EMAIL\",\"name\":\"$ROLLOUT_ID\"}"

curl --fail-with-body \
  -X POST "$PRODUCTION_URL/api/track" \
  -H "Authorization: Bearer $CLERK_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"event\":\"context_feedback\",\"properties\":{\"rolloutId\":\"$ROLLOUT_ID\"}}"
```

Confirm both writes in the database; the HTTP responses are not sufficient:

```bash
psql "$DATABASE_URL" \
  -X \
  -v ON_ERROR_STOP=1 \
  -v rollout_canary_email="$ROLLOUT_CANARY_EMAIL" \
  -v rollout_id="$ROLLOUT_ID" <<'SQL'
select id, email, name, created_at
from public.waitlist
where email = :'rollout_canary_email'
  and name = :'rollout_id';

select id, user_id, event, properties, created_at
from public.events
where event = 'context_feedback'
  and properties ->> 'rolloutId' = :'rollout_id';
SQL
```

After recording evidence, either retain the rows under the production
canary-data policy or delete them with an administrative connection:

```bash
psql "$DATABASE_URL" \
  -X \
  -v ON_ERROR_STOP=1 \
  -v rollout_canary_email="$ROLLOUT_CANARY_EMAIL" \
  -v rollout_id="$ROLLOUT_ID" <<'SQL'
delete from public.waitlist
where email = :'rollout_canary_email'
  and name = :'rollout_id';

delete from public.events
where event = 'context_feedback'
  and properties ->> 'rolloutId' = :'rollout_id';
SQL
```

## Rollback boundary

The explicit `psql --single-transaction` path is atomic. For any other migration
runner, confirm its transaction behavior before the release; do not infer
atomicity from a failed command. After a committed apply, prefer fixing the
server environment or `service_role` grants. The migration changes access
metadata and does not delete application data.

After public traffic starts, rollback is a security regression: it restores the
direct-write bypass. Pause beta traffic or otherwise protect the Data API before
using this emergency reverse migration:

```sql
begin;

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename in ('events', 'waitlist')
      and policyname in ('events insert only', 'waitlist insert only')
  ) then
    raise exception 'Legacy policy name is already in use; review live policy state';
  end if;
end
$$;

create policy "events insert only" on public.events
  for insert to public
  with check (true);

create policy "waitlist insert only" on public.waitlist
  for insert to public
  with check (true);

grant insert on table public.events to anon, authenticated;
grant insert on table public.waitlist to anon, authenticated;

commit;
```

Migration-history repair does not execute rollback SQL. Change history only
after the live schema matches the intended state. This rollback cannot remove
abusive rows written before hardening.

## Public-beta promotion checklist

- [ ] Approved PR commit and migration checksum match the operator checkout.
- [ ] Lint, tests, CLI sync, typecheck, build, and benchmark pass at that commit.
- [ ] Production service-role key is present and server-only.
- [ ] Migration history and schema-drift checks pass.
- [ ] Only migration `004` is applied before application promotion.
- [ ] Anon/authenticated denial and service-role write probes pass.
- [ ] Waitlist and analytics writes are confirmed in the database.
- [ ] API errors, rate limits, and both write streams are monitored during
      initial traffic.
- [ ] A named operator owns the fix-forward or emergency rollback decision.

# Supabase public-write hardening rollout

Migration `004_harden_public_writes.sql` removes direct writes by `anon` and
`authenticated` to `public.events` and `public.waitlist`. Application writes
continue through server routes using `service_role`.

Use one operator, capture all output in the change ticket, and do not combine
`004` with migrations `005`–`009`. Roll out the agent schema separately after
this security boundary is verified.

## 1. Release identity

Record the reviewed release commit and migration checksum before the window:

```bash
: "${APPROVED_RELEASE_SHA:?Set the approved main commit}"
: "${APPROVED_MIGRATION_SHA256:?Set the reviewed migration checksum}"

test "$(git rev-parse HEAD)" = "$APPROVED_RELEASE_SHA"
test -z "$(git status --porcelain)"
test "$(
  git show HEAD:supabase/migrations/004_harden_public_writes.sql \
    | shasum -a 256 \
    | awk '{print $1}'
)" = "$APPROVED_MIGRATION_SHA256"
```

## 2. Preflight

Confirm the linked project is production and inspect history without writes:

```bash
supabase migration list --linked
```

For the hardening window, migrations `001`–`003` must be present remotely.
Migration `004` and the agent migrations `005`–`009` may be pending in the
current checkout. Stop on missing or divergent history. Do not run
`supabase db push` from this checkout during the hardening window because it
would apply the agent schema too. Do not use `--include-all` or repair migration
history until the live schema is inspected.

Run these read-only queries against production:

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
  v.is_updatable,
  v.is_insertable_into,
  has_table_privilege(
    'anon',
    format('public.%I', v.table_name),
    'INSERT,UPDATE,DELETE'
  ) as anon_write,
  has_table_privilege(
    'authenticated',
    format('public.%I', v.table_name),
    'INSERT,UPDATE,DELETE'
  ) as authenticated_write
from information_schema.views v
where v.table_schema = 'public'
  and (v.is_updatable = 'YES' or v.is_insertable_into = 'YES')
order by v.table_name;
```

All gates must pass:

- Both tables exist, the migration identity matches, and the operator can alter
  both tables.
- RLS is enabled on both tables.
- `service_role` has effective `INSERT` on both tables.
- Public API roles have no unexpected write privilege or permissive write
  policy.
- Every public executable or `SECURITY DEFINER` routine and every updatable
  view is reviewed for an indirect write path.
- Deployment evidence shows `SUPABASE_SERVICE_ROLE_KEY` only in server-side
  environment variables and no `NEXT_PUBLIC_*` value contains it.

## 3. Safe apply

Apply only the reviewed hardening file with an administrative production
connection:

```bash
: "${DATABASE_URL:?Set the production direct Postgres connection string}"

psql "$DATABASE_URL" \
  -X \
  -v ON_ERROR_STOP=1 \
  --single-transaction \
  -c "set local search_path = pg_catalog, public; set local lock_timeout = '5s'; set local statement_timeout = '30s';" \
  -f supabase/migrations/004_harden_public_writes.sql
```

The command is atomic and intentionally does not advance Supabase migration
history. In the later agent-schema window, `supabase db push --linked` will
execute the idempotent `004` checks again before applying `005`–`009` and will
then record the complete history. Do not repair history or mix apply paths in
the hardening window.

## 4. Post-migration verification

Repeat the RLS, policy, privilege, routine, and view queries above. Required
postconditions:

- RLS remains enabled.
- No permissive public `INSERT`, `UPDATE`, `DELETE`, or `ALL` policy remains.
- `anon` and `authenticated` have no effective write privilege.
- `service_role` retains effective `INSERT`.

Verify the service path without retaining data:

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

Each public-role probe must fail with SQLSTATE `42501`. A connection, syntax,
authentication, or timeout failure does not count:

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

Verify both application paths with unique correlation values:

```bash
: "${PRODUCTION_URL:?Set the production application URL}"
: "${ROLLOUT_CANARY_EMAIL:?Use a controlled unique plus-address}"
: "${CLERK_SESSION_TOKEN:?Use a short-lived canary session}"

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

HTTP success is insufficient. Confirm both writes in the database:

```sql
select id, email, name, created_at
from public.waitlist
where email = :'rollout_canary_email'
  and name = :'rollout_id';

select id, user_id, event, properties, created_at
from public.events
where event = 'context_feedback'
  and properties ->> 'rolloutId' = :'rollout_id';
```

Delete the canaries with an administrative connection after evidence is
recorded, unless the production canary-data policy requires retention.

## 5. Rollback boundary

The `psql --single-transaction` path is atomic. For any other runner, verify
transaction behavior before applying. Migration `004` changes access metadata
and deletes no application data.

After public traffic starts, rollback is a security regression. Pause beta
traffic or protect the Data API before running this emergency reverse change:

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
    raise exception 'Legacy policy name already exists; inspect live state';
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

Prefer fix-forward for a broken server environment or missing `service_role`
grant. Migration-history repair does not execute rollback SQL. This rollback
cannot remove abusive rows written before hardening.

## 6. Public-beta promotion checklist

- [ ] Approved `main` commit and migration checksum match the operator checkout.
- [ ] Lint, tests, CLI sync, typecheck, build, and benchmark pass at that commit.
- [ ] Production `service_role` key is present and server-only.
- [ ] Migration history and schema-drift checks pass.
- [ ] Only migration `004` is applied in the hardening window.
- [ ] Public-role denial and service-role write probes pass.
- [ ] Waitlist and analytics canaries are confirmed in the database.
- [ ] Agent migrations `005`–`009` pass a separate dry run and change review.
- [ ] API errors, rate limits, workflow failures, and both write streams are
  monitored during initial traffic.
- [ ] A named operator owns the fix-forward or emergency rollback decision.

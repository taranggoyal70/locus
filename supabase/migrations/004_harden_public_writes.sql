-- Server routes use the service role for analytics and waitlist writes.
-- Anonymous clients should not be able to bypass validation and rate limits
-- by writing to the REST tables directly.
do $$
declare
  table_name text;
begin
  if to_regrole('anon') is null
    or to_regrole('authenticated') is null
    or to_regrole('service_role') is null then
    raise exception 'Expected Supabase API roles are missing';
  end if;

  foreach table_name in array array['events', 'waitlist'] loop
    if to_regclass(format('public.%I', table_name)) is null then
      raise exception 'Required table public.% is missing', table_name;
    end if;

    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = table_name
        and c.relrowsecurity
    ) then
      raise exception 'RLS must be enabled on public.% before hardening', table_name;
    end if;

    if not has_table_privilege(
      'service_role',
      format('public.%I', table_name),
      'INSERT'
    ) then
      raise exception 'service_role must retain INSERT on public.%', table_name;
    end if;
  end loop;
end
$$;

drop policy if exists "events insert only" on public.events;
drop policy if exists "waitlist insert only" on public.waitlist;

revoke insert, update, delete, truncate, references, trigger
  on table public.events
  from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger
  on table public.waitlist
  from anon, authenticated;

do $$
declare
  table_name text;
  privilege_name text;
begin
  foreach table_name in array array['events', 'waitlist'] loop
    foreach privilege_name in array array[
      'INSERT',
      'UPDATE',
      'DELETE',
      'TRUNCATE',
      'REFERENCES',
      'TRIGGER'
    ] loop
      if has_table_privilege(
        'anon',
        format('public.%I', table_name),
        privilege_name
      ) or has_table_privilege(
        'authenticated',
        format('public.%I', table_name),
        privilege_name
      ) then
        raise exception
          'Public API roles still have % on public.%',
          privilege_name,
          table_name;
      end if;
    end loop;

    if not has_table_privilege(
      'service_role',
      format('public.%I', table_name),
      'INSERT'
    ) then
      raise exception 'service_role lost INSERT on public.%', table_name;
    end if;
  end loop;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename in ('events', 'waitlist')
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      and permissive = 'PERMISSIVE'
      and roles && array['public', 'anon', 'authenticated']::name[]
  ) then
    raise exception 'A permissive public write policy remains on events or waitlist';
  end if;
end
$$;

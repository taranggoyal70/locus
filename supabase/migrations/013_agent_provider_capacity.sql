-- Serialize free-tier provider use so one user's Run cannot exhaust quota for everyone else.
create table public.agent_provider_leases (
  run_id uuid primary key references public.agent_runs(id) on delete cascade,
  model text not null check (length(model) between 1 and 160),
  acquired_at timestamptz not null default now(),
  released_at timestamptz,
  expires_at timestamptz not null
);

create index agent_provider_leases_model_expiry_idx
  on public.agent_provider_leases (model, expires_at);

alter table public.agent_provider_leases enable row level security;
revoke all on table public.agent_provider_leases from public, anon, authenticated;
grant select, insert, update, delete on table public.agent_provider_leases to service_role;

create or replace function public.acquire_agent_provider_lease(
  p_run_id uuid,
  p_model text,
  p_max_concurrent integer default 1,
  p_lease_seconds integer default 3600
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_active integer;
  v_next_expiry timestamptz;
begin
  if p_model is null or length(p_model) not between 1 and 160
    or p_max_concurrent not between 1 and 10
    or p_lease_seconds not between 60 and 7200 then
    raise exception 'Invalid provider lease arguments';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_model, 0));

  delete from public.agent_provider_leases where expires_at <= v_now;

  if exists (select 1 from public.agent_provider_leases where run_id = p_run_id) then
    allowed := true;
    retry_after_seconds := 0;
    return next;
    return;
  end if;

  select count(*), min(expires_at)
  into v_active, v_next_expiry
  from public.agent_provider_leases
  where model = p_model and expires_at > v_now;

  if v_active >= p_max_concurrent then
    allowed := false;
    retry_after_seconds := greatest(
      1,
      ceil(extract(epoch from (v_next_expiry - v_now)))::integer
    );
    return next;
    return;
  end if;

  insert into public.agent_provider_leases (run_id, model, acquired_at, expires_at)
  values (p_run_id, p_model, v_now, v_now + make_interval(secs => p_lease_seconds));

  allowed := true;
  retry_after_seconds := 0;
  return next;
end;
$$;

create or replace function public.release_agent_provider_lease(
  p_run_id uuid,
  p_cooldown_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_model text;
begin
  if p_cooldown_seconds not between 1 and 300 then
    raise exception 'Invalid provider cooldown';
  end if;

  select model into v_model
  from public.agent_provider_leases
  where run_id = p_run_id
  for update;

  if v_model is null then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_model, 0));

  update public.agent_provider_leases
  set
    released_at = v_now,
    expires_at = v_now + make_interval(secs => p_cooldown_seconds)
  where run_id = p_run_id;

  return true;
end;
$$;

revoke all on function public.acquire_agent_provider_lease(uuid, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.acquire_agent_provider_lease(uuid, text, integer, integer)
  to service_role;

revoke all on function public.release_agent_provider_lease(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.release_agent_provider_lease(uuid, integer)
  to service_role;

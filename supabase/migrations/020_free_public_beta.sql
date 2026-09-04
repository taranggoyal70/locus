-- Freeze the provider route on every Run. Existing records predate the direct
-- Cloudflare route and remain truthful as Vercel AI Gateway Runs.
alter table public.agent_runs
  add column provider text not null default 'vercel-ai-gateway'
    check (length(provider) between 1 and 80),
  add column execution_mode text not null default 'shared'
    check (execution_mode in ('shared', 'byok'));

alter table public.agent_runs alter column provider drop default;

-- User-owned provider tokens are encrypted by the application before this
-- table sees them. Browser roles receive no policy and no table grant.
create table public.agent_provider_credentials (
  user_id text not null,
  provider text not null check (provider = 'cloudflare-workers-ai'),
  account_id text not null check (account_id ~ '^[a-f0-9]{32}$'),
  encrypted_api_token text not null check (length(encrypted_api_token) between 40 and 2048),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

alter table public.agent_provider_credentials enable row level security;
revoke all on table public.agent_provider_credentials from public, anon, authenticated;
grant select, insert, update, delete on table public.agent_provider_credentials to service_role;

-- A durable record of shared free-pool admission. Claims survive Run failure so
-- retries cannot multiply provider spend after a partially completed request.
create table public.agent_provider_daily_claims (
  run_id uuid primary key references public.agent_runs(id) on delete cascade,
  provider text not null check (length(provider) between 1 and 80),
  usage_day date not null,
  claimed_at timestamptz not null default now()
);

create index agent_provider_daily_claims_provider_day_idx
  on public.agent_provider_daily_claims (provider, usage_day);

alter table public.agent_provider_daily_claims enable row level security;
revoke all on table public.agent_provider_daily_claims from public, anon, authenticated;
grant select, insert, delete on table public.agent_provider_daily_claims to service_role;

create or replace function public.claim_agent_provider_daily_slot(
  p_run_id uuid,
  p_provider text,
  p_max_daily integer default 1
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_day date := (v_now at time zone 'UTC')::date;
  v_reset timestamptz := (
    date_trunc('day', v_now at time zone 'UTC') + interval '1 day'
  ) at time zone 'UTC';
  v_count integer;
begin
  if p_run_id is null
    or p_provider is null or length(p_provider) not between 1 and 80
    or p_max_daily is null or p_max_daily not between 1 and 100 then
    raise exception 'Invalid provider daily claim arguments';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_provider || ':' || v_day::text, 0)
  );

  if exists (
    select 1 from public.agent_provider_daily_claims where run_id = p_run_id
  ) then
    allowed := true;
    retry_after_seconds := 0;
    return next;
    return;
  end if;

  select count(*) into v_count
  from public.agent_provider_daily_claims
  where provider = p_provider and usage_day = v_day;

  if v_count >= p_max_daily then
    allowed := false;
    retry_after_seconds := greatest(
      1,
      ceil(extract(epoch from (v_reset - v_now)))::integer
    );
    return next;
    return;
  end if;

  insert into public.agent_provider_daily_claims (run_id, provider, usage_day, claimed_at)
  values (p_run_id, p_provider, v_day, v_now);

  allowed := true;
  retry_after_seconds := 0;
  return next;
end;
$$;

revoke all on function public.claim_agent_provider_daily_slot(uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.claim_agent_provider_daily_slot(uuid, text, integer)
  to service_role;

-- Overload the atomic per-user Run claim with frozen provider/execution fields.
-- The seven-argument Release 1 function remains available during rolling deploys.
create or replace function public.claim_agent_run_slot(
  p_user_id text,
  p_task_id uuid,
  p_model text,
  p_token_budget integer,
  p_active_statuses text[],
  p_max_active integer,
  p_max_daily integer,
  p_provider text,
  p_execution_mode text
)
returns table (allowed boolean, reason text, run_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_active integer;
  v_daily integer;
  v_run_id uuid;
begin
  if p_user_id is null or length(p_user_id) not between 1 and 255
    or p_task_id is null
    or p_model is null or length(p_model) not between 1 and 160
    or p_token_budget is null
    or p_active_statuses is null or coalesce(array_length(p_active_statuses, 1), 0) = 0
    or array_position(p_active_statuses, null) is not null
    or p_max_active is null or p_max_active not between 1 and 100
    or p_max_daily is null or p_max_daily not between 1 and 10000
    or p_provider is null or length(p_provider) not between 1 and 80
    or p_execution_mode not in ('shared', 'byok') then
    raise exception 'Invalid agent run claim arguments';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id, 0));

  select count(*) into v_active
  from public.agent_runs
  where user_id = p_user_id and status = any(p_active_statuses);

  if v_active >= p_max_active then
    allowed := false; reason := 'active'; run_id := null;
    return next; return;
  end if;

  select count(*) into v_daily
  from public.agent_runs
  where user_id = p_user_id and created_at >= v_now - interval '24 hours';

  if v_daily >= p_max_daily then
    allowed := false; reason := 'daily'; run_id := null;
    return next; return;
  end if;

  insert into public.agent_runs (
    task_id, user_id, model, token_budget, provider, execution_mode
  ) values (
    p_task_id, p_user_id, p_model, p_token_budget, p_provider, p_execution_mode
  ) returning id into v_run_id;

  allowed := true; reason := null; run_id := v_run_id;
  return next;
end;
$$;

revoke all on function public.claim_agent_run_slot(
  text, uuid, text, integer, text[], integer, integer, text, text
) from public, anon, authenticated;
grant execute on function public.claim_agent_run_slot(
  text, uuid, text, integer, text[], integer, integer, text, text
) to service_role;

-- Remove the pre-provider overload of claim_agent_run_slot.
--
-- 016 created a 7-argument version. This migration's `create or replace` above
-- declares a 9-argument one, and Postgres treats a different signature as an
-- overload rather than a replacement, so both existed. The old one is not merely
-- redundant: this migration drops the `provider` default, so the 7-argument body
-- inserts a null provider and fails the not-null constraint on every call.
--
-- Verified against a full replay of 001-020: calling the 7-argument form raised
-- "null value in column provider of relation agent_runs violates not-null
-- constraint". Leaving a broken function granted to service_role is a trap for
-- an older deployment mid-rollout and for any hand-written query, so it goes.
--
-- This is what makes 020 the first migration in this chain that is NOT
-- backward compatible with the previous application version. Rolling the
-- application back requires rolling this migration back with it; the rollout
-- documents say so.
drop function if exists public.claim_agent_run_slot(
  text, uuid, text, integer, text[], integer, integer
);

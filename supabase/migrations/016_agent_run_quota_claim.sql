-- R12: close the Agent Run quota race.
--
-- The Run creation path counted a user's active and daily Runs, decided against
-- the limits, and then inserted. Nothing held between the count and the insert,
-- so concurrent requests all read the same pre-insert counts and all passed.
-- Measured against this schema before the fix: six concurrent requests against a
-- limit of two created six active Runs. The 3-per-60s start rate limit bounds how
-- fast the race can be attempted; it does not close it.
--
-- Counting and inserting now happen in one transaction under a per-user advisory
-- lock, following the pattern already established by
-- `acquire_agent_provider_lease` in 013. The lock is keyed on the user rather
-- than the table so two different users never wait on each other.
--
-- Limits and the active-status list are parameters rather than constants: they
-- have a source of truth in `src/lib/agent/run-quota.ts` and
-- `src/lib/agent/run-state.ts`, and duplicating them here would let the two
-- drift. Retry-after policy stays in the application for the same reason, so this
-- returns the reason and lets the caller decide what to tell the user.
create or replace function public.claim_agent_run_slot(
  p_user_id text,
  p_task_id uuid,
  p_model text,
  p_token_budget integer,
  p_active_statuses text[],
  p_max_active integer,
  p_max_daily integer
)
returns table (
  allowed boolean,
  reason text,
  run_id uuid
)
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
  -- Fail closed on malformed input rather than silently admitting a Run. An
  -- empty status array would make every Run look inactive and disable the
  -- active-run limit entirely, so it is rejected rather than treated as "none".
  if p_user_id is null or length(p_user_id) not between 1 and 255
    or p_task_id is null
    or p_model is null or length(p_model) not between 1 and 160
    or p_token_budget is null
    or p_active_statuses is null or coalesce(array_length(p_active_statuses, 1), 0) = 0
    or array_position(p_active_statuses, null) is not null
    or p_max_active is null or p_max_active not between 1 and 100
    or p_max_daily is null or p_max_daily not between 1 and 10000 then
    raise exception 'Invalid agent run claim arguments';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id, 0));

  select count(*)
  into v_active
  from public.agent_runs
  where user_id = p_user_id
    and status = any(p_active_statuses);

  if v_active >= p_max_active then
    allowed := false;
    reason := 'active';
    run_id := null;
    return next;
    return;
  end if;

  select count(*)
  into v_daily
  from public.agent_runs
  where user_id = p_user_id
    and created_at >= v_now - interval '24 hours';

  if v_daily >= p_max_daily then
    allowed := false;
    reason := 'daily';
    run_id := null;
    return next;
    return;
  end if;

  -- The task is the caller's to own: this function deliberately does not create
  -- it, so a denied claim never leaves a half-built Run behind.
  insert into public.agent_runs (task_id, user_id, model, token_budget)
  values (p_task_id, p_user_id, p_model, p_token_budget)
  returning id into v_run_id;

  allowed := true;
  reason := null;
  run_id := v_run_id;
  return next;
end;
$$;

revoke all on function public.claim_agent_run_slot(text, uuid, text, integer, text[], integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_agent_run_slot(text, uuid, text, integer, text[], integer, integer)
  to service_role;

-- Keep pre-execution provider-capacity denials in the Run ledger without
-- charging the account's rolling Run quota. The application-side advisory
-- count uses the same predicate; this function remains the atomic authority.
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
  where user_id = p_user_id
    and created_at >= v_now - interval '24 hours'
    and not (
      status = 'failed'
      and failure_kind = 'quota_exhausted'
      and workflow_run_id is null
    );

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

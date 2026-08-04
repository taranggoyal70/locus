-- Enforce the published retention boundary with one daily, service-only transaction.
create or replace function public.delete_expired_agent_data(
  p_retention_days integer default 30
)
returns table (
  deleted_runs integer,
  deleted_tasks integer,
  deleted_events integer,
  deleted_waitlist_entries integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cutoff timestamptz;
  v_operational_cutoff timestamptz;
begin
  if p_retention_days not between 7 and 365 then
    raise exception 'Retention must be between 7 and 365 days';
  end if;

  v_cutoff := clock_timestamp() - make_interval(days => p_retention_days);
  v_operational_cutoff := clock_timestamp() - interval '90 days';
  perform pg_catalog.set_config('locus.retention_delete', 'on', true);

  delete from public.agent_runs
  where status in ('completed', 'rejected', 'failed', 'cancelled')
    and completed_at < v_cutoff;
  get diagnostics deleted_runs = row_count;

  delete from public.agent_tasks as tasks
  where tasks.updated_at < v_cutoff
    and not exists (
      select 1 from public.agent_runs as runs where runs.task_id = tasks.id
    );
  get diagnostics deleted_tasks = row_count;

  delete from public.events where created_at < v_operational_cutoff;
  get diagnostics deleted_events = row_count;

  delete from public.waitlist where created_at < v_operational_cutoff;
  get diagnostics deleted_waitlist_entries = row_count;

  return next;
end;
$$;

revoke all on function public.delete_expired_agent_data(integer)
  from public, anon, authenticated;
grant execute on function public.delete_expired_agent_data(integer)
  to service_role;

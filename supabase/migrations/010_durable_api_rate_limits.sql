create table public.api_rate_limits (
  bucket text primary key check (length(bucket) between 1 and 160),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  expires_at timestamptz not null
);

create index api_rate_limits_expires_at_idx
  on public.api_rate_limits (expires_at);

alter table public.api_rate_limits enable row level security;

revoke all on table public.api_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.api_rate_limits to service_role;

create or replace function public.consume_api_rate_limit(
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_started_at timestamptz;
  v_request_count integer;
begin
  if length(p_bucket) not between 1 and 160
    or p_limit not between 1 and 10000
    or p_window_seconds not between 1 and 86400 then
    raise exception 'Invalid rate-limit arguments';
  end if;

  delete from public.api_rate_limits
  where bucket in (
    select bucket
    from public.api_rate_limits
    where expires_at <= v_now
    order by expires_at
    limit 100
  );

  insert into public.api_rate_limits (
    bucket,
    window_started_at,
    request_count,
    expires_at
  )
  values (
    p_bucket,
    v_now,
    1,
    v_now + make_interval(secs => p_window_seconds)
  )
  on conflict (bucket) do update
  set
    window_started_at = case
      when api_rate_limits.window_started_at + make_interval(secs => p_window_seconds) <= v_now then v_now
      else api_rate_limits.window_started_at
    end,
    request_count = case
      when api_rate_limits.window_started_at + make_interval(secs => p_window_seconds) <= v_now then 1
      else least(api_rate_limits.request_count + 1, p_limit + 1)
    end,
    expires_at = case
      when api_rate_limits.window_started_at + make_interval(secs => p_window_seconds) <= v_now
        then v_now + make_interval(secs => p_window_seconds)
      else api_rate_limits.expires_at
    end
  returning window_started_at, request_count
    into v_window_started_at, v_request_count;

  allowed := v_request_count <= p_limit;
  remaining := greatest(0, p_limit - v_request_count);
  retry_after_seconds := case
    when allowed then 0
    else greatest(
      1,
      ceil(extract(epoch from (
        v_window_started_at + make_interval(secs => p_window_seconds) - v_now
      )))::integer
    )
  end;
  return next;
end;
$$;

revoke all on function public.consume_api_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, integer, integer)
  to service_role;

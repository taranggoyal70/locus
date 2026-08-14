-- R17: make Stripe subscription writes replay-safe and order-safe.
--
-- The webhook's three handlers were each individually idempotent — every one is a
-- last-write-wins upsert or update, so processing the same event twice writes the
-- same values. The gap recorded as "the idempotency ledger did not ship" was
-- therefore not the live risk.
--
-- The live risk is ordering. Stripe does not guarantee delivery order, so a
-- delayed `customer.subscription.updated` carrying `status: active` can arrive
-- after `customer.subscription.deleted` and restore paid access to a cancelled
-- account. An event-id ledger alone would not prevent that, because those are two
-- distinct events.
--
-- So the row records which event last wrote it. Stripe event.created is seconds
-- since the Unix epoch, so equal timestamps can be different events; ambiguity
-- resolves toward the more restrictive state. Same-second active events are
-- refused, while same-second inactive or cancelled events apply. The cost is
-- that a legitimate same-second grant may be dropped, but a same-second
-- restriction must not leave paid access in place. Both checks live in the same
-- statement as the write: reading the watermark and then updating would
-- reintroduce exactly the race closed in 016, since Stripe retries deliveries
-- concurrently.
alter table public.subscriptions
  add column if not exists last_event_id text,
  add column if not exists last_event_created_at timestamptz;

update public.subscriptions
set last_event_created_at = coalesce(updated_at, created_at)
where last_event_created_at is null;

comment on column public.subscriptions.last_event_created_at is
  'Stripe `event.created` of the last applied event. Older events are refused; identical-second grants are refused.';

-- `checkout.session.completed`. Creates the row or advances it, never regresses it.
create or replace function public.upsert_stripe_subscription(
  p_user_id text,
  p_customer_id text,
  p_subscription_id text,
  p_plan text,
  p_status text,
  p_event_id text,
  p_event_created timestamptz
)
returns table (applied boolean, skipped_reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer;
begin
  if p_user_id is null or length(p_user_id) not between 1 and 255
    or p_customer_id is null or length(p_customer_id) not between 1 and 255
    or p_subscription_id is null or length(p_subscription_id) not between 1 and 255
    or p_plan is null or p_status is null
    or p_event_id is null or length(p_event_id) not between 1 and 255
    or p_event_created is null then
    raise exception 'Invalid Stripe subscription upsert arguments';
  end if;

  insert into public.subscriptions (
    user_id, stripe_customer_id, stripe_subscription_id,
    plan, status, last_event_id, last_event_created_at
  )
  values (
    p_user_id, p_customer_id, p_subscription_id,
    p_plan, p_status, p_event_id, p_event_created
  )
  on conflict (user_id) do update
    set
      stripe_customer_id = excluded.stripe_customer_id,
      stripe_subscription_id = excluded.stripe_subscription_id,
      plan = excluded.plan,
      status = excluded.status,
      last_event_id = excluded.last_event_id,
      last_event_created_at = excluded.last_event_created_at
    where
      -- Refuse a replay of the event already applied, and refuse an event older
      -- than or equal to the one already applied.
      public.subscriptions.last_event_id is distinct from excluded.last_event_id
      and public.subscriptions.last_event_created_at < excluded.last_event_created_at;

  get diagnostics v_rows = row_count;

  applied := v_rows > 0;
  skipped_reason := case when v_rows > 0 then null else 'stale-or-duplicate-event' end;
  return next;
end;
$$;

-- `customer.subscription.updated` and `customer.subscription.deleted`.
-- A null p_plan leaves the plan unchanged, which is what `updated` needs.
create or replace function public.apply_stripe_subscription_event(
  p_subscription_id text,
  p_status text,
  p_plan text,
  p_event_id text,
  p_event_created timestamptz
)
returns table (applied boolean, skipped_reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer;
begin
  if p_subscription_id is null or length(p_subscription_id) not between 1 and 255
    or p_status is null or length(p_status) not between 1 and 64
    or p_event_id is null or length(p_event_id) not between 1 and 255
    or p_event_created is null then
    raise exception 'Invalid Stripe subscription event arguments';
  end if;

  update public.subscriptions
  set
    status = p_status,
    plan = coalesce(p_plan, plan),
    last_event_id = p_event_id,
    last_event_created_at = p_event_created
  where stripe_subscription_id = p_subscription_id
    and last_event_id is distinct from p_event_id
    and (
      last_event_created_at < p_event_created
      or (last_event_created_at = p_event_created and p_status in ('inactive', 'cancelled'))
    )
    and (status <> 'cancelled' or p_status = 'cancelled');

  get diagnostics v_rows = row_count;

  applied := v_rows > 0;
  -- A miss here is either a stale event, a duplicate, or an unknown subscription.
  -- They are reported the same way on purpose: the webhook must not disclose
  -- whether a given Stripe subscription id exists in this database.
  skipped_reason := case when v_rows > 0 then null else 'stale-duplicate-or-unknown' end;
  return next;
end;
$$;

revoke all on function public.upsert_stripe_subscription(text, text, text, text, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.upsert_stripe_subscription(text, text, text, text, text, text, timestamptz)
  to service_role;

revoke all on function public.apply_stripe_subscription_event(text, text, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.apply_stripe_subscription_event(text, text, text, text, timestamptz)
  to service_role;

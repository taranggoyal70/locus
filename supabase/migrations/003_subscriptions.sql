-- Stripe subscriptions for Pro tier billing
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  plan text not null default 'free' check (plan in ('free', 'pro', 'enterprise')),
  status text not null default 'active' check (status in ('active', 'inactive', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_subscriptions_user on subscriptions (user_id);
create index idx_subscriptions_stripe_sub on subscriptions (stripe_subscription_id);

create trigger subscriptions_updated_at
  before update on subscriptions
  for each row execute function update_updated_at();

alter table subscriptions enable row level security;

create policy "users own subscriptions" on subscriptions
  for all using (user_id = current_setting('app.user_id', true));

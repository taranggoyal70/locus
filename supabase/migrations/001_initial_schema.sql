-- Projects: saved analyses users can return to
create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  repo_url text not null,
  task text not null,
  slice_files integer not null default 0,
  total_files integer not null default 0,
  saved_pct integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_projects_user on projects (user_id, updated_at desc);

-- API keys for programmatic access
create table api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  key_hash text not null,
  prefix text not null,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_api_keys_hash on api_keys (key_hash);
create index idx_api_keys_user on api_keys (user_id);

-- Usage events for analytics
create table events (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  event text not null,
  properties jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index idx_events_user on events (user_id, created_at desc);
create index idx_events_type on events (event, created_at desc);

-- Auto-update updated_at on projects
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger projects_updated_at
  before update on projects
  for each row execute function update_updated_at();

-- Row-level security
alter table projects enable row level security;
alter table api_keys enable row level security;
alter table events enable row level security;

-- RLS policies: users can only access their own data
create policy "users own projects" on projects
  for all using (user_id = current_setting('app.user_id', true));

create policy "users own api_keys" on api_keys
  for all using (user_id = current_setting('app.user_id', true));

create policy "events insert only" on events
  for insert with check (true);

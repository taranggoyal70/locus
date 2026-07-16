-- GitHub OAuth connections for private repo access
create table github_connections (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  github_username text not null,
  access_token text not null,
  scopes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_github_connections_user on github_connections (user_id);

create trigger github_connections_updated_at
  before update on github_connections
  for each row execute function update_updated_at();

alter table github_connections enable row level security;

create policy "users own github_connections" on github_connections
  for all using (user_id = current_setting('app.user_id', true));

-- Teams for collaboration
create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_teams_owner on teams (owner_id);

create trigger teams_updated_at
  before update on teams
  for each row execute function update_updated_at();

alter table teams enable row level security;

-- Team members
create table team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  user_id text not null,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now()
);

create unique index idx_team_members_unique on team_members (team_id, user_id);
create index idx_team_members_user on team_members (user_id);

alter table team_members enable row level security;

-- Waitlist for Pro tier
create table waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  company text,
  use_case text,
  created_at timestamptz not null default now()
);

alter table waitlist enable row level security;

create policy "waitlist insert only" on waitlist
  for insert with check (true);

-- Add team_id to projects (nullable for personal projects)
alter table projects add column team_id uuid references teams(id) on delete set null;
create index idx_projects_team on projects (team_id, updated_at desc);

-- Durable, auditable execution state for the slice-first coding agent.
-- Browser clients never access these tables directly; authenticated server
-- routes enforce Clerk ownership and use the service role.

create table agent_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  repo_url text not null,
  base_ref text not null default 'main',
  task text not null,
  acceptance_criteria text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_agent_tasks_user
  on agent_tasks (user_id, created_at desc);

create trigger agent_tasks_updated_at
  before update on agent_tasks
  for each row execute function update_updated_at();

create table agent_runs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references agent_tasks(id) on delete cascade,
  user_id text not null,
  status text not null default 'queued'
    check (status in (
      'queued',
      'localizing',
      'planning',
      'executing',
      'verifying',
      'awaiting_approval',
      'completed',
      'failed',
      'cancelled'
    )),
  model text not null,
  sandbox_id text,
  branch_name text,
  baseline_tokens integer not null default 0 check (baseline_tokens >= 0),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  cached_input_tokens integer not null default 0 check (cached_input_tokens >= 0),
  cost_microusd bigint not null default 0 check (cost_microusd >= 0),
  included_files text[] not null default '{}',
  excluded_files text[] not null default '{}',
  widened_files text[] not null default '{}',
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_agent_runs_task on agent_runs (task_id, created_at desc);
create index idx_agent_runs_user on agent_runs (user_id, created_at desc);
create index idx_agent_runs_active
  on agent_runs (updated_at asc)
  where status in ('queued', 'localizing', 'planning', 'executing', 'verifying');

create trigger agent_runs_updated_at
  before update on agent_runs
  for each row execute function update_updated_at();

create table agent_steps (
  id bigint generated always as identity primary key,
  run_id uuid not null references agent_runs(id) on delete cascade,
  user_id text not null,
  sequence integer not null check (sequence >= 0),
  kind text not null
    check (kind in ('localize', 'plan', 'tool', 'widen', 'verify', 'approval', 'delivery')),
  status text not null
    check (status in ('running', 'completed', 'failed', 'skipped')),
  title text not null,
  detail jsonb not null default '{}',
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (run_id, sequence)
);

create index idx_agent_steps_run on agent_steps (run_id, sequence);
create index idx_agent_steps_user on agent_steps (user_id, started_at desc);

create table agent_artifacts (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references agent_runs(id) on delete cascade,
  user_id text not null,
  kind text not null
    check (kind in ('plan', 'diff', 'test', 'build', 'pull_request', 'preview', 'summary')),
  label text not null,
  url text,
  content text,
  created_at timestamptz not null default now()
);

create index idx_agent_artifacts_run on agent_artifacts (run_id, created_at);
create index idx_agent_artifacts_user on agent_artifacts (user_id, created_at desc);

create table agent_approvals (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references agent_runs(id) on delete cascade,
  user_id text not null,
  action text not null check (action in ('push', 'open_pull_request', 'deploy', 'merge')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'expired')),
  payload jsonb not null default '{}',
  expires_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_agent_approvals_run on agent_approvals (run_id, created_at);
create index idx_agent_approvals_pending
  on agent_approvals (user_id, created_at)
  where status = 'pending';

alter table agent_tasks enable row level security;
alter table agent_runs enable row level security;
alter table agent_steps enable row level security;
alter table agent_artifacts enable row level security;
alter table agent_approvals enable row level security;

revoke all on table agent_tasks from anon, authenticated;
revoke all on table agent_runs from anon, authenticated;
revoke all on table agent_steps from anon, authenticated;
revoke all on table agent_artifacts from anon, authenticated;
revoke all on table agent_approvals from anon, authenticated;

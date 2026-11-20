-- R15: every Widen request becomes a durable, ordered, auditable event.
--
-- The Slice ledger recorded only grants, as a blob written once at the end of a
-- Run. That loses two things a reviewer needs:
--
--   1. Refusals. A Run that tried nine times to widen into .github/ and was
--      refused every time was indistinguishable, in the stored evidence, from
--      one that never tried. Widening is the documented way an injected
--      instruction walks out of its Slice one justified-sounding file at a
--      time, so the refused attempts are the signal, not the noise.
--   2. Order. A single array written at the end cannot say what was asked for
--      before what, which is what makes a probing pattern legible at all.
--
-- These rows are evidence, so they are immutable once written, exactly like
-- agent_reviews and published agent_artifacts.

create table public.agent_widen_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  user_id text not null,
  -- 1-based, per Run, in attempt order. Unique with run_id so a replayed or
  -- duplicated write cannot silently reorder the trail.
  sequence integer not null check (sequence >= 1),
  -- Deliberately not constrained to a valid repo path: an invalid_path refusal
  -- stores the raw input the Agent asked for, which is the evidence itself.
  path text not null check (length(path) between 1 and 1000),
  reason text not null check (length(reason) <= 2000),
  outcome text not null check (outcome in ('granted', 'refused')),
  refusal text check (
    refusal is null or refusal in (
      'missing_reason',
      'not_excluded',
      'sensitive_path',
      'limit_exceeded',
      'invalid_path'
    )
  ),
  -- The message the Agent itself received, so the reviewer reads what the Agent read.
  detail text check (detail is null or length(detail) <= 2000),
  created_at timestamptz not null default now(),
  unique (run_id, sequence),
  -- A grant has no refusal cause and a refusal must name one. Enforced here so
  -- the trail cannot record an outcome it does not explain.
  constraint agent_widen_events_outcome_reason check (
    (outcome = 'granted' and refusal is null)
    or (outcome = 'refused' and refusal is not null)
  )
);

create index agent_widen_events_run_idx
  on public.agent_widen_events (run_id, sequence);

-- Supports the question this table exists to answer: has this account been
-- probing its Slice boundary lately, across runs?
create index agent_widen_events_refused_idx
  on public.agent_widen_events (user_id, created_at desc)
  where outcome = 'refused';

alter table public.agent_widen_events enable row level security;
revoke all on table public.agent_widen_events from public, anon, authenticated;
grant select on table public.agent_widen_events to service_role;

create trigger immutable_agent_widen_events
  before update or delete on public.agent_widen_events
  for each row
  execute function public.prevent_agent_evidence_mutation();

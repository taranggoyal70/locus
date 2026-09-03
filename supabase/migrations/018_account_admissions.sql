-- Durable Admission records, so access is data rather than a deploy.
--
-- Admission currently lives in ALPHA_ALLOWED_USER_IDS. That was correct for a
-- handful of invited design partners and is wrong for self-serve for three
-- reasons: granting access requires an environment edit and a redeploy, there is
-- nowhere to record when or why an account was admitted, and there is no way to
-- suspend a single abusive account without removing everyone in the list.
--
-- This table is the operator's control surface. It does not replace the
-- allowlist or the subscriptions table; the resolver reads all three and takes
-- the highest tier, so an operator grant can raise an account but never silently
-- demote a paying customer.
create table public.account_admissions (
  user_id text primary key check (length(user_id) between 1 and 255),

  -- `visitor` is storable on purpose. An absent row means "not yet decided" and
  -- falls through to the other admission rules; a stored `visitor` means
  -- "explicitly refused" and is how a single account is denied without touching
  -- anyone else. The two are different states and collapsing them would make a
  -- ban indistinguishable from a new signup.
  tier text not null check (tier in ('visitor', 'free', 'partner', 'pro')),

  -- Why this row exists. Kept because a tier with no provenance cannot be
  -- audited later, and "who let this account in?" is the first question asked
  -- after an abuse incident.
  source text not null check (source in ('self_serve', 'operator', 'subscription')),

  -- Free-text operator justification. Bounded so a note cannot be used as
  -- unbounded storage on a table the service role writes on every signup.
  note text check (note is null or length(note) <= 500),

  granted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Operators list recent grants and suspensions far more often than they look up
-- a known id, and the primary key does not serve that order.
create index account_admissions_granted_at_idx
  on public.account_admissions (granted_at desc);

alter table public.account_admissions enable row level security;

-- Same posture as every other table in this schema: the browser roles reach
-- nothing, and the server decides. An account must not be able to read its own
-- row directly either, because `note` carries operator commentary about the
-- account that was never written for its subject to read.
revoke all on table public.account_admissions from public, anon, authenticated;
grant select, insert, update, delete on table public.account_admissions to service_role;

create trigger account_admissions_updated_at
  before update on public.account_admissions
  for each row execute function public.update_updated_at();

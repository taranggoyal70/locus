-- Release 1: hard Run budgets, immutable proposal evidence, and artifact-bound review.

alter table public.agent_runs
  add column token_budget integer not null default 180000
    check (token_budget between 10000 and 240000),
  add column failure_kind text
    check (failure_kind in (
      'quota_exhausted',
      'token_budget_exhausted',
      'provider_error',
      'sandbox_error',
      'verification_error',
      'workflow_error'
    )),
  add column proposal_hash text
    check (proposal_hash ~ '^[0-9a-f]{64}$');

alter table public.agent_runs
  drop constraint if exists agent_runs_status_check;

alter table public.agent_runs
  add constraint agent_runs_status_check
  check (status in (
    'queued',
    'localizing',
    'planning',
    'executing',
    'verifying',
    'awaiting_approval',
    'completed',
    'rejected',
    'failed',
    'cancelled'
  ));

alter table public.agent_artifacts
  add column content_sha256 text
    check (content_sha256 ~ '^[0-9a-f]{64}$'),
  add column base_revision text;

create unique index agent_artifacts_one_proposal_kind_idx
  on public.agent_artifacts (run_id, kind)
  where kind in ('change_set', 'diff', 'summary') and content_sha256 is not null;

create table public.agent_reviews (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs(id) on delete cascade,
  user_id text not null,
  proposal_hash text not null check (proposal_hash ~ '^[0-9a-f]{64}$'),
  decision text not null check (decision in ('accepted', 'rejected')),
  criterion_decisions jsonb not null
    check (jsonb_typeof(criterion_decisions) = 'array'),
  note text check (note is null or length(note) <= 2000),
  created_at timestamptz not null default now(),
  unique (run_id)
);

create index agent_reviews_user_created_idx
  on public.agent_reviews (user_id, created_at desc);

alter table public.agent_reviews enable row level security;
revoke all on table public.agent_reviews from public, anon, authenticated;
grant select on table public.agent_reviews to service_role;

create or replace function public.prevent_agent_evidence_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
    and current_setting('locus.retention_delete', true) = 'on' then
    return old;
  end if;

  raise exception 'Published Agent evidence is immutable';
end;
$$;

create trigger immutable_published_agent_artifacts
  before update or delete on public.agent_artifacts
  for each row
  when (old.content_sha256 is not null)
  execute function public.prevent_agent_evidence_mutation();

create trigger immutable_agent_reviews
  before update or delete on public.agent_reviews
  for each row
  execute function public.prevent_agent_evidence_mutation();

create or replace function public.publish_agent_proposal(
  p_run_id uuid,
  p_user_id text,
  p_base_revision text,
  p_change_set text,
  p_diff text,
  p_summary text,
  p_tool_detail jsonb,
  p_verify_detail jsonb,
  p_included_context_tokens integer,
  p_input_tokens integer,
  p_cached_input_tokens integer,
  p_output_tokens integer,
  p_widened_files text[],
  p_excluded_files text[]
)
returns table (proposal_hash text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_token_budget integer;
  v_included_files text[];
  v_change_set_hash text;
  v_diff_hash text;
  v_summary_hash text;
  v_proposal_hash text;
begin
  if p_user_id is null or length(p_user_id) not between 1 and 255
    or p_base_revision is null or length(p_base_revision) not between 7 and 255
    or p_change_set is null or length(p_change_set) not between 2 and 5000000
    or p_diff is null or length(p_diff) not between 1 and 5000000
    or p_summary is null or length(p_summary) not between 1 and 20000
    or jsonb_typeof(coalesce(p_tool_detail, '{}'::jsonb)) <> 'object'
    or jsonb_typeof(coalesce(p_verify_detail, '{}'::jsonb)) <> 'object'
    or p_included_context_tokens < 0
    or p_input_tokens < 0
    or p_cached_input_tokens < 0
    or p_output_tokens < 0 then
    raise exception 'Invalid Agent proposal arguments';
  end if;

  if jsonb_typeof(p_tool_detail -> 'changedFiles') <> 'array'
    or jsonb_array_length(p_tool_detail -> 'changedFiles') = 0
    or exists (
      select 1
      from jsonb_array_elements(p_tool_detail -> 'changedFiles') as changed_file(value)
      where jsonb_typeof(changed_file.value) <> 'string'
        or length(changed_file.value #>> '{}') = 0
    ) then
    raise exception 'Changed-file evidence must contain at least one path';
  end if;

  if jsonb_typeof(p_verify_detail -> 'checks') <> 'array'
    or jsonb_array_length(p_verify_detail -> 'checks') = 0
    or exists (
      select 1
      from jsonb_array_elements(p_verify_detail -> 'checks') as verification_check(value)
      where jsonb_typeof(verification_check.value) <> 'object'
        or jsonb_typeof(verification_check.value -> 'command') <> 'string'
        or length(verification_check.value ->> 'command') = 0
        or jsonb_typeof(verification_check.value -> 'exitCode') <> 'number'
        or (verification_check.value ->> 'exitCode')::integer <> 0
    ) then
    raise exception 'Verification evidence must contain at least one successful check';
  end if;

  select status, token_budget, included_files
  into v_status, v_token_budget, v_included_files
  from public.agent_runs
  where id = p_run_id and user_id = p_user_id
  for update;

  if v_status is null then
    raise exception 'Agent Run was not found';
  end if;
  if v_status <> 'executing' then
    raise exception 'Agent Run is not executing';
  end if;
  if p_input_tokens + p_output_tokens > v_token_budget then
    raise exception 'Agent Run exceeded its token budget';
  end if;

  v_change_set_hash := encode(extensions.digest(convert_to(p_change_set, 'UTF8'), 'sha256'), 'hex');
  v_diff_hash := encode(extensions.digest(convert_to(p_diff, 'UTF8'), 'sha256'), 'hex');
  v_summary_hash := encode(extensions.digest(convert_to(p_summary, 'UTF8'), 'sha256'), 'hex');
  v_proposal_hash := encode(
    extensions.digest(
      convert_to(
        concat_ws(
          E'\x1e',
          p_base_revision,
          v_change_set_hash,
          v_diff_hash,
          v_summary_hash,
          p_tool_detail::text,
          p_verify_detail::text,
          p_included_context_tokens::text,
          p_input_tokens::text,
          p_cached_input_tokens::text,
          p_output_tokens::text,
          array_to_string(coalesce(v_included_files, '{}'), E'\x1f'),
          array_to_string(coalesce(p_widened_files, '{}'), E'\x1f'),
          array_to_string(coalesce(p_excluded_files, '{}'), E'\x1f')
        ),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  update public.agent_runs
  set
    status = 'verifying',
    included_context_tokens = p_included_context_tokens,
    input_tokens = p_input_tokens,
    cached_input_tokens = p_cached_input_tokens,
    output_tokens = p_output_tokens,
    widened_files = coalesce(p_widened_files, '{}'),
    excluded_files = coalesce(p_excluded_files, '{}'),
    failure_kind = null,
    error = null
  where id = p_run_id and user_id = p_user_id and status = 'executing';

  insert into public.agent_steps (
    run_id, user_id, sequence, kind, status, title, detail,
    input_tokens, output_tokens, completed_at
  ) values (
    p_run_id, p_user_id, 2, 'tool', 'completed', 'Repository changes prepared',
    p_tool_detail, p_input_tokens, p_output_tokens, clock_timestamp()
  ), (
    p_run_id, p_user_id, 3, 'verify', 'completed', 'Verification evidence collected',
    p_verify_detail, 0, 0, clock_timestamp()
  );

  insert into public.agent_artifacts (
    run_id, user_id, kind, label, content, content_sha256, base_revision
  ) values
    (
      p_run_id, p_user_id, 'change_set', 'Approval-gated delivery payload',
      p_change_set, v_change_set_hash, p_base_revision
    ),
    (
      p_run_id, p_user_id, 'diff', 'Proposed repository diff',
      p_diff, v_diff_hash, p_base_revision
    ),
    (
      p_run_id, p_user_id, 'summary', 'Agent summary',
      p_summary, v_summary_hash, p_base_revision
    );

  update public.agent_runs
  set status = 'awaiting_approval', proposal_hash = v_proposal_hash
  where id = p_run_id and user_id = p_user_id and status = 'verifying';

  proposal_hash := v_proposal_hash;
  return next;
end;
$$;

create or replace function public.decide_agent_proposal(
  p_run_id uuid,
  p_user_id text,
  p_proposal_hash text,
  p_decision text,
  p_criterion_decisions jsonb,
  p_note text default null
)
returns table (run_status text, review_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_proposal_hash text;
  v_criteria text[];
  v_review_id uuid;
  v_run_status text;
begin
  select runs.status, runs.proposal_hash, tasks.acceptance_criteria
  into v_status, v_proposal_hash, v_criteria
  from public.agent_runs as runs
  join public.agent_tasks as tasks on tasks.id = runs.task_id
  where runs.id = p_run_id and runs.user_id = p_user_id and tasks.user_id = p_user_id
  for update of runs;

  if v_status is null then
    raise exception 'Agent Run was not found';
  end if;
  if v_status <> 'awaiting_approval' then
    raise exception 'Agent Run is not awaiting review';
  end if;
  if p_proposal_hash <> v_proposal_hash then
    raise exception 'Proposal hash does not match the published evidence';
  end if;
  if p_decision not in ('accepted', 'rejected')
    or jsonb_typeof(p_criterion_decisions) <> 'array'
    or jsonb_array_length(p_criterion_decisions) <> cardinality(v_criteria)
    or p_note is not null and length(p_note) > 2000 then
    raise exception 'Invalid review decision';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_criterion_decisions) with ordinality as item(value, position)
    where jsonb_typeof(item.value) <> 'object'
      or item.value ->> 'criterion' is distinct from v_criteria[item.position]
      or jsonb_typeof(item.value -> 'satisfied') <> 'boolean'
      or (item.value ? 'evidence' and jsonb_typeof(item.value -> 'evidence') <> 'string')
      or length(item.value ->> 'criterion') > 1000
      or length(coalesce(item.value ->> 'evidence', '')) > 2000
  ) then
    raise exception 'Criterion decisions must match the frozen acceptance criteria';
  end if;

  if p_decision = 'accepted' and exists (
    select 1
    from jsonb_array_elements(p_criterion_decisions) as item(value)
    where (item.value ->> 'satisfied')::boolean is not true
  ) then
    raise exception 'Accepted proposals require every criterion to be satisfied';
  end if;

  insert into public.agent_reviews (
    run_id, user_id, proposal_hash, decision, criterion_decisions, note
  ) values (
    p_run_id, p_user_id, p_proposal_hash, p_decision, p_criterion_decisions, p_note
  )
  returning id into v_review_id;

  v_run_status := case when p_decision = 'accepted' then 'completed' else 'rejected' end;

  insert into public.agent_steps (
    run_id, user_id, sequence, kind, status, title, detail, completed_at
  ) values (
    p_run_id,
    p_user_id,
    4,
    'approval',
    case when p_decision = 'accepted' then 'completed' else 'failed' end,
    case when p_decision = 'accepted' then 'Proposal accepted by reviewer' else 'Proposal rejected by reviewer' end,
    jsonb_build_object(
      'proposalHash', p_proposal_hash,
      'decision', p_decision,
      'criteria', p_criterion_decisions,
      'note', p_note
    ),
    clock_timestamp()
  );

  update public.agent_runs
  set status = v_run_status, completed_at = clock_timestamp(), error = null, failure_kind = null
  where id = p_run_id and user_id = p_user_id and status = 'awaiting_approval';

  run_status := v_run_status;
  review_id := v_review_id;
  return next;
end;
$$;

revoke all on function public.publish_agent_proposal(
  uuid, text, text, text, text, text, jsonb, jsonb,
  integer, integer, integer, integer, text[], text[]
) from public, anon, authenticated;
grant execute on function public.publish_agent_proposal(
  uuid, text, text, text, text, text, jsonb, jsonb,
  integer, integer, integer, integer, text[], text[]
) to service_role;

revoke all on function public.decide_agent_proposal(
  uuid, text, text, text, jsonb, text
) from public, anon, authenticated;
grant execute on function public.decide_agent_proposal(
  uuid, text, text, text, jsonb, text
) to service_role;

revoke all on function public.prevent_agent_evidence_mutation()
  from public, anon, authenticated;

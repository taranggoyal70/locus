-- Persist a bounded, reviewable delivery payload separately from the display diff.
alter table agent_artifacts
  drop constraint if exists agent_artifacts_kind_check;

alter table agent_artifacts
  add constraint agent_artifacts_kind_check
  check (kind in (
    'plan',
    'diff',
    'change_set',
    'test',
    'build',
    'pull_request',
    'preview',
    'summary'
  ));

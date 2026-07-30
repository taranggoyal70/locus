-- Correlate durable Workflow runs with Locus' user-facing run ledger.
alter table agent_runs
  add column workflow_run_id text;

create unique index idx_agent_runs_workflow
  on agent_runs (workflow_run_id)
  where workflow_run_id is not null;

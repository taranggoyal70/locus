-- Make approval delivery concurrency-safe and retryable without losing the audit trail.
alter table agent_approvals
  drop constraint if exists agent_approvals_status_check;

alter table agent_approvals
  add constraint agent_approvals_status_check
  check (status in (
    'pending',
    'delivering',
    'approved',
    'failed',
    'rejected',
    'expired'
  ));

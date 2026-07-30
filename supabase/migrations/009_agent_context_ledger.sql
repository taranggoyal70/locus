-- Keep context reduction (the product USP) separate from model usage.
alter table agent_runs
  add column included_context_tokens integer not null default 0
  check (included_context_tokens >= 0);

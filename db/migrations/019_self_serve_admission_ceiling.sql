-- Support the self-serve account ceiling.
--
-- `LOCUS_SELF_SERVE_MAX_ACCOUNTS` bounds how many self-serve accounts a
-- deployment will admit, which is the control that actually limits spend:
-- per-account Run quota bounds one account's cost and says nothing about how
-- many accounts exist, and signup is free.
--
-- Enforcing it means counting the self-serve rows for every stranger who arrives
-- without an Admission record. A partial index keeps that a count over the
-- matching rows rather than a scan of the whole table, and it stays small
-- because it indexes only the one source value the ceiling is about - operator
-- grants and subscription rows are excluded from both the count and the index.
create index account_admissions_self_serve_idx
  on public.account_admissions (user_id)
  where source = 'self_serve';

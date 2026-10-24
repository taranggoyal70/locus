# Incident response runbook

## Detection and ownership

The release operator owns first response until an incident lead is recorded. Detection sources are the scheduled GitHub `Production health` workflow, Vercel alert rules and function/workflow logs, the `/api/health` revision, Supabase Run/Step evidence, provider dashboards, and an optional `OPS_ALERT_WEBHOOK_URL` channel. Stable events include `agent.run.failed`, `agent.run.review_ready`, `agent.alert.delivery_failed`, provider-lease failures, and retention-job failures. Use Run IDs as correlation identifiers; never copy source, diffs, credentials, task text, or user identifiers into incident chat.

## Severity

- Critical: confirmed data exposure, destructive external action, credential compromise, evidence mutation, or total production loss.
- High: broad Run failure, quota exhaustion across users, missing review evidence, retention failure, or authentication bypass without confirmed exposure.
- Normal: isolated defects, degraded non-critical behavior, and support questions.

Response targets are four hours for Critical, one business day for High, and three business days for Normal. They are targets, not guarantees.

## First 15 minutes

1. Record UTC start time, production revision, reporter, incident lead, and one redacted correlation ID.
2. Confirm scope from durable evidence. Do not infer success from HTTP status or a single passing Check.
3. Disable new Agent Runs. This takes **two** changes when self-serve is open, and doing only the first is the most likely mistake in this runbook: clear `ALPHA_ALLOWED_USER_IDS` **and** clear `LOCUS_SELF_SERVE`, then redeploy. Confirm containment against `/api/health`, which must report `readiness.admission: "invite_only"` and an empty allowlist — a deploy that did not take looks identical to one that did from the dashboard. Neither change cancels Runs already queued behind the provider lease; cancel those separately if the incident requires it. Do not delete existing evidence.
4. To contain a single account rather than everyone, store an explicit refusal instead of closing the product. This takes effect on that account's next request with no deploy, and it beats the allowlist and an active subscription:

   ```sql
   insert into public.account_admissions (user_id, tier, source, note)
   values ('user_2abc…', 'visitor', 'operator', 'Incident <id>: <one line>')
   on conflict (user_id) do update
     set tier = 'visitor', source = 'operator', note = excluded.note;
   ```

   Always write the `note`. "Who let this account in, and who took it out?" is answerable only from the row.
5. For credential exposure, revoke and rotate the affected provider, Supabase, Clerk, GitHub, or Vercel credential. Never paste the replacement into the incident record.
6. For unexpected external writes, keep delivery capability off and revoke stored connections. Do not re-enable a public write policy.
7. For provider quota incidents, leave the global lease/cooldown enabled, inspect `failure_kind`, and wait for the provider window before a single controlled retry.

## Diagnose and recover

- Compare the live health revision with the approved release SHA.
- Query Run status, `failure_kind`, token budget, proposal hash, Steps, and review decision. Proposal artifacts and reviews must remain immutable.
- Roll application code back first when the schema is backward compatible. Release 1 migrations are additive and should normally remain in place.
- Fix forward database security, RLS, review immutability, and retention defects. Never restore public table writes or deleted legacy OAuth tokens.
- Run the post-migration and production canaries in `release-1-readiness-rollout.md` before reopening admission to one design partner.
- Reopen in the order the doors were closed, not together: restore the allowlist first and canary one design partner, then reopen `LOCUS_SELF_SERVE` only after that canary passes. Reopening both at once means a recurrence cannot be attributed to either.
- Admission fails closed on its own outage: when `account_admissions` cannot be read, only the allowlist is honoured and self-serve is forced closed. A wave of `admission.read_failed` in the logs is therefore a database symptom, not an access-control breach — but it does mean suspensions are not being read, so a suspended account is refused only because self-serve is closed too. Restore the database before reopening.

## Communication and closure

Publish known impact, current containment, next update time, and whether user action is required on the support surface. Do not claim resolution until health, critical browser paths, database verification, and a controlled Run canary pass. Close with a timeline, root cause, affected boundaries, corrective actions, evidence links, and an owner/date for every follow-up. Security incidents receive a private advisory; public summaries contain no exploit-enabling or personal data.

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
3. Disable new Agent Runs by clearing `ALPHA_ALLOWED_USER_IDS` in production and redeploying. Do not delete existing evidence.
4. For credential exposure, revoke and rotate the affected provider, Supabase, Clerk, GitHub, or Vercel credential. Never paste the replacement into the incident record.
5. For unexpected external writes, keep delivery capability off and revoke stored connections. Do not re-enable a public write policy.
6. For provider quota incidents, leave the global lease/cooldown enabled, inspect `failure_kind`, and wait for the provider window before a single controlled retry.

## Diagnose and recover

- Compare the live health revision with the approved release SHA.
- Query Run status, `failure_kind`, token budget, proposal hash, Steps, and review decision. Proposal artifacts and reviews must remain immutable.
- Roll application code back first when the schema is backward compatible. Release 1 migrations are additive and should normally remain in place.
- Fix forward database security, RLS, review immutability, and retention defects. Never restore public table writes or deleted legacy OAuth tokens.
- Run the post-migration and production canaries in `release-1-readiness-rollout.md` before reopening admission to one design partner.

## Communication and closure

Publish known impact, current containment, next update time, and whether user action is required on the support surface. Do not claim resolution until health, critical browser paths, database verification, and a controlled Run canary pass. Close with a timeline, root cause, affected boundaries, corrective actions, evidence links, and an owner/date for every follow-up. Security incidents receive a private advisory; public summaries contain no exploit-enabling or personal data.

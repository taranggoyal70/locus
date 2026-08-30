# Locus best-version plan

Status: accepted for implementation
Date: 2026-08-01

## Product thesis

Locus is not another code chat. It is a token-efficient coding agent that takes
an Agent Task from Repo evidence to a verified, approval-gated delivery. Its
defensible advantage is not a small first prompt; it is fewer total tokens per
verified task, with a visible record of every file admitted, excluded, or
Widened.

## Council decision

The product grill, Standards review, Spec review, and architecture review agreed
on one ordering: make Runs trustworthy before making the agent broader.

The present product has a capable execution prototype, but four failures break
the promise:

1. Failed Runs can display a token-saving claim.
2. Step rows are rewritten, so the audit trail is not append-only.
3. A completed planning Step is recorded without a planning operation.
4. Refresh loses the active Run while the Runs screen shows legacy analyses.

The first release slice therefore deepens the Run module and ships durable Run
history/resume. More editing tools without this foundation would produce more
untrustworthy evidence.

## Version shape

### 1. Trustworthy Run foundation — now

- Guard every lifecycle transition and keep terminal Runs immutable.
- Insert completed Steps once; use Run status for live progress.
- Report cached, input, output, and total model tokens.
- Expose a Savings claim only for a completed Run.
- Persist the active Run in the URL so refresh resumes polling.
- Replace the legacy analyses screen with Run history, evidence review,
  cancellation, approval, and resume.

### 2. Verified execution depth — next

- Introduce a genuine plan Artifact before repository mutation.
- Add patch, delete, move, and rename tools behind Slice permissions.
- Record every Widen decision as an append-only Step.
- Turn acceptance criteria into explicit user-editable proof requirements.
- Add deterministic failure cases for no-change, exhausted model, Sandbox
  failure, failed checks, and Widen.

### 3. Review equals delivery

- Replace the truncated review/full change-set split with one canonical staged
  Artifact.
- Require the reviewed Artifact hash during approval.
- Enforce approval expiry, base-SHA freshness, and idempotent GitHub delivery.
- Recover cleanly when GitHub succeeds but evidence persistence is interrupted.

### 4. Honest token advantage

- Attribute usage to Localize, plan, implementation, Widen, verification, and
  delivery Steps.
- Run paired whole-Repo baselines in evaluation, not in customer Runs.
- Claim savings only when both variants satisfy the same acceptance criteria.
- Publish verified-task success rate beside median total-token reduction.

## Public-beta gate

A version is public-beta ready only when a developer can start a Run, refresh or
leave, reopen it from history, inspect included/excluded/Widened files, review
the exact staged change, see real verification evidence, approve delivery, and
receive a Savings claim only after completion.

## Deliberate exclusions

- No autonomous merge or production deploy in public early access.
- No savings claim for failed or cancelled Runs.
- No silent access to excluded files; the agent must Widen with a reason.
- No generic chat surface. Agent Tasks and Run evidence remain the interface.

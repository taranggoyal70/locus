# Self-serve Admission rollout

## Ownership and scope

The release operator owns this rollout. Its scope is one variable,
`LOCUS_SELF_SERVE`, and the `account_admissions` table introduced by migration
018.

Opening self-serve admits signed-in accounts to the `free` Tier: 1 concurrent and
3 daily Agent Runs on public Repos. It does not release any capability. GitHub
connection, private Repo reads, external delivery, Teams, billing, and Savings
claims are withheld by `CAPABILITY_RELEASE` in `src/lib/admission.ts`, which is
code and changes only through a reviewed commit. Do not treat this rollout as
approval to widen any of them.

## Preflight

From a clean `main` checkout that matches `origin/main`:

```bash
pnpm lint
pnpm test
pnpm typecheck
pnpm check:alpha-claims
pnpm check-sync
pnpm build
pnpm audit --audit-level high
```

Confirm migration 018 is applied to the production database and that
`account_admissions` exists with row-level security enabled. Confirm
`/api/health` reports `admission: "invite_only"` before the change, which proves
the deployment is reading the variable you are about to set.

Establish the cost baseline before opening, because the free Tier spends provider
capacity. Record current daily Run volume, the provider lease contention rate,
and the token spend per Run. Without a before, the after means nothing.

## Capacity check

Free-tier provider capacity serialises at one concurrent lease
(`acquire_agent_provider_lease`, `p_max_concurrent: 1`). Every admitted account
holding a Run open queues behind that single lease.

Three daily Runs per free account against one concurrent lease means admission
volume, not per-account quota, is the control that matters. Set
`LOCUS_SELF_SERVE_MAX_ACCOUNTS` before opening. Deciding a number and not
enforcing it is not a control.

Start small — a ceiling you would be comfortable paying for twice over, since a
Run's cost varies with the Repo. Raising it later is one variable and a redeploy;
refunding an unbounded month is not.

Self-serve additionally requires a verified email address. That is not
configurable and needs no rollout step, but it is the reason a signup that
completes in Clerk may still not reach the free Tier, and it is worth knowing
before the first support question about it.

Closing the variable does not cancel Runs already queued behind the lease.

## Opening

```bash
vercel env add LOCUS_SELF_SERVE production   # value: open
vercel deploy --prod
```

`open` is the only accepted value. `true`, `1`, `yes`, and `on` are rejected and
leave the deployment invite-only, so verify rather than assume:

```bash
curl -s https://locus-five-iota.vercel.app/api/health | jq .admission
```

Expect `"self_serve"`. If it still reports `"invite_only"`, the variable did not
take effect and no account has been admitted.

## Pausing without closing

Set `LOCUS_SELF_SERVE_MAX_ACCOUNTS=0` and redeploy. Nobody new is admitted and
every already-admitted account keeps working, which is the right first move when
cost is climbing faster than expected but nothing is actually wrong. Clearing
`LOCUS_SELF_SERVE` is the heavier option and is still what an incident calls for.

Watch `admission_resolved` for `at_capacity`: a rising count is the signal that
demand is hitting the ceiling rather than that the product stopped working.

## Granting an account a higher Tier

A row in `account_admissions` raises an account above what the allowlist,
subscription, and self-serve rules give it. This takes effect on the account's
next request; no deploy is involved.

```sql
insert into public.account_admissions (user_id, tier, source, note)
values ('user_2abc…', 'pro', 'operator', 'Design partner comp, approved 2026-09-03')
on conflict (user_id) do update
  set tier = excluded.tier,
      source = excluded.source,
      note = excluded.note;
```

Always write the `note`. "Who let this account in?" is the first question asked
after an abuse incident, and a tier with no provenance cannot answer it.

## Suspending an account

Store `visitor`. A stored `visitor` is an explicit refusal rather than an absent
decision, and it beats every other rule, including an active subscription and the
design-partner allowlist.

```sql
insert into public.account_admissions (user_id, tier, source, note)
values ('user_2abc…', 'visitor', 'operator', 'Abuse: see incident 2026-09-03-01')
on conflict (user_id) do update
  set tier = 'visitor', source = 'operator', note = excluded.note;
```

The suspended account sees "This account cannot start Agent Runs. Contact
support", not a waitlist message. Runs already in flight are not cancelled by
this; cancel them separately if the incident requires it.

To reverse a suspension, delete the row rather than setting it back to `free`.
Deleting returns the account to "not yet decided", so it falls through to the
normal rules; setting `free` would pin it there even if it later subscribes.

```sql
delete from public.account_admissions where user_id = 'user_2abc…';
```

## Rollback

Clearing `LOCUS_SELF_SERVE` and redeploying returns the deployment to
invite-only. Accounts already admitted keep their `account_admissions` row, so
they retain the `free` Tier: the row is an explicit grant, and closing the door
does not revoke grants already made.

To revoke as well as close:

```sql
delete from public.account_admissions
where source = 'self_serve' and granted_at >= '2026-09-03T00:00:00Z';
```

Scope that delete by time. Deleting every `self_serve` row would also remove
accounts admitted in an earlier, unrelated window.

Migration 018 is additive and safe to leave installed for the previous
application version.

## What this rollout does not do

- It does not release GitHub connection, private Repo reads, delivery, Teams, or
  billing. Those need a change to `CAPABILITY_RELEASE` and their own rollout.
- It does not enable Savings claims, which remain gated on the Release 1 paired
  evidence contract rather than on any Tier.
- It does not change the invited-partner allowance, which stays at 2 concurrent
  and 10 daily so Release 1 evidence collection is unaffected.

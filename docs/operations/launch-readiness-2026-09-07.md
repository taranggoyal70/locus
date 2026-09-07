# Launch readiness record — 2026-09-07

## Decision

**Hold Agent Run admission closed. Public Repo localization may remain public.**

The database launch blocker is remediated, but the shared Agent provider is not
configured and the frozen production canary has not run. This is therefore a
go for the existing public localization surface and a no-go for opening
`LOCUS_SELF_SERVE`.

## Evidence retained

- Reviewed base revision before this launch branch: `0f2e15a`.
- Supabase production migration history was inspected in the web dashboard and
  initially ended at `017` (`stripe_event_ordering`).
- Reviewed migrations `018_account_admissions.sql`,
  `019_self_serve_admission_ceiling.sql`, and `020_free_public_beta.sql` were
  applied in order from the Supabase web SQL editor on 2026-09-07. The migration
  history page now shows `020`, `019`, and `018` above `017`.
- Supabase Security Advisor showed zero errors and zero warnings after the
  migration. Performance Advisor showed zero findings.
- Production `/api/health` then changed from missing `database` and
  `agent_provider` to missing only `agent_provider` while admission remained
  `invite_only`.
- Repository conflict residue was removed and `pnpm check:merge-markers` was
  added to CI and to the release preflight.

## Public Agent Run gate

Every row is fail-closed. A row changes to **PASS** only when its dated evidence
link, run ID, revision, or retained artifact is added here. `LOCUS_SELF_SERVE`
must remain empty until every row is **PASS**.

| Gate | Status | Retained evidence or required proof |
|---|---|---|
| Repository integrity, tests, typecheck, build, and dependency audit | **PASS** | Revision `86e8994`; branch checks on 2026-09-07: 811 tests passed, production build passed, zero known dependency vulnerabilities, and no merge markers |
| Production database history and security | **PASS** | [Supabase migrations](https://supabase.com/dashboard/project/gwyrfkubdvgemrkkffpr/database/migrations) `001`–`020`; [Security Advisor](https://supabase.com/dashboard/project/gwyrfkubdvgemrkkffpr/advisors/security) zero errors/warnings; [Performance Advisor](https://supabase.com/dashboard/project/gwyrfkubdvgemrkkffpr/advisors/performance) zero findings on 2026-09-07 |
| Shared Workers AI provider configured | **FAIL** | Add the Cloudflare account confirmation and Vercel deployment revision; never retain token values |
| Production health for the reviewed revision | **FAIL** | Require HTTP 200, `status: "ok"`, the reviewed revision, and `readiness.missing: []` |
| Desktop and mobile critical paths | **FAIL** | Retain production checks for `/`, `/demo`, `/workspace`, sign-in, settings, pricing, docs, privacy, terms, support, and Run history |
| Keyboard and accessibility verification | **FAIL** | Retain production keyboard navigation, focus, labels, contrast, and automated accessibility results |
| Performance verification | **FAIL** | Retain production Core Web Vitals or Lighthouse evidence at the agreed launch thresholds |
| Alert delivery | **FAIL** | Retain the intentional `test_alert=true` failure notification and the following healthy production-health run |
| Frozen BYOK and shared-pool canary | **FAIL** | Retain Run IDs, execution modes, proposal hashes, Checks, review evidence, quota denial, and proof of no external write |
| 24–48 hour one-partner canary | **FAIL** | Retain start/end timestamps and zero Critical incidents, evidence mutations, unexplained quota failures, or external writes |
| Incident and rollback rehearsal | **FAIL** | Retain the operator, timestamps, containment result, compatible deployment revision, health recovery, and lessons |
| Branch and deployment protection | **FAIL** | Require reviewed CI on `main`, prevent force-push/delete, and restrict production deployment to the approved branch/revision |
| Billing-disabled behavior | **FAIL** | Retain signed-in production checks proving no purchase path or paid entitlement is exposed in this launch |
| Final public capability audit | **FAIL** | Record the released `runStart` capability and prove private reads, teams, delivery, billing, autonomous merge, and autonomous deploy remain disabled |

After all rows pass, set a conservative `LOCUS_SELF_SERVE_MAX_ACCOUNTS`, set
`LOCUS_SELF_SERVE=open`, and redeploy the same reviewed SHA. Re-run production
health and the critical path once more before announcing availability.

Private Repo reads, external GitHub delivery, teams, billing, autonomous merge,
and autonomous deployment remain outside this launch. They require separate
capability review and evidence; this record does not authorize them.

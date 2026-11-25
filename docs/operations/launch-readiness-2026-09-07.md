# Launch readiness record — 2026-09-07

## Decision

**Hold Agent Run admission closed. Public Repo localization may remain public.**

The production database, shared Agent provider, reviewed application revision,
and health contract are now ready. The frozen signed-in canary, alert-delivery
test, full browser/accessibility sweep, and soak period are still outstanding.
This remains a go for the existing public localization surface and a no-go for
opening `LOCUS_SELF_SERVE`.

**Update 2026-11-25.** The owner opened `LOCUS_SELF_SERVE` ahead of this gate
and chose to keep it open once a signed-in shared Run succeeded in production
(below). Rows still marked **FAIL** are outstanding risk accepted by the owner,
not evidence that they pass. Shared Runs are limited to one per account per UTC
day within a deployment ceiling of one (`LOCUS_SHARED_DAILY_RUN_LIMIT` unset);
the operator account in `LOCUS_OWNER_USER_IDS` is exempt so production can be
verified after the public has used the pool.

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
- Pull request [#70](https://github.com/taranggoyal70/locus/pull/70) passed lint,
  tests, typecheck, build, CodeQL, and Vercel checks, then was rebase-merged as
  production revision `ee73df1` on 2026-09-07.
- The full documented repository preflight passed from a clean `main` checkout
  at `ee73df1`: 107 test files and 811 tests passed, 2 files and 9 tests were
  intentionally skipped, and the dependency audit reported no known
  vulnerabilities.
- Cloudflare account token `Locus Production Workers AI` was created for the
  single account with only Workers AI Read and Workers AI Write permissions.
  `CLOUDFLARE_ACCOUNT_ID` and the sensitive `CLOUDFLARE_API_TOKEN` are scoped to
  Vercel Production; no token value was retained here.
- A direct request to the frozen model `@cf/qwen/qwen3.8-27b` returned HTTP 200
  with `success: true`. This verifies provider authentication but does not
  replace the signed-in Locus Run canary below.
- The original production URL returned HTTP 200 with `status: "ok"`, revision
  `ee73df1`, `readiness.missing: []`, configured external health checking, and
  `admission: "invite_only"`.
- The production homepage and interactive `/demo` story rendered successfully;
  the demo advanced through its complete approval-ready state. Production logs
  contained no error-level or HTTP 500 entries during this verification window.
- On 2026-11-25 at production revision `b8fb89b` the operator account started
  shared Run `3a8eef4a-02c2-4cf4-b878-7e3c4f6927aa` from the signed-in desktop
  workspace on `taranggoyal70/locus`. It fixed the singular token label in
  `src/components/AgentRunsList.tsx` and added a test. It reached Review-ready
  in about two minutes using 32,221 of its 100,000 tokens, with proposal hash
  `59fe3cbb74022fcfcff58c00324d40c85d60bf8c85119c750cfd38eaf898de9a`. The
  Slice held 38 of 332 files, both target files among them. The patch applied
  to a clean checkout of `b8fb89b` and the named test file passed (2 tests).
  External writes stayed off; GitHub delivery is withheld. An earlier shared Run
  the same day, `e40a882a-52f9-4b98-b1fb-4b476e269758` at `b3f7579`, ended in
  `verification_error`.
- `main` is protected: lint-test, typecheck, build, codeql, and gitleaks are
  required, administrators are included, and force-push and deletion are
  blocked.

## Public Agent Run gate

Every row is fail-closed. A row changes to **PASS** only when its dated evidence
link, run ID, revision, or retained artifact is added here. `LOCUS_SELF_SERVE`
must remain empty until every row is **PASS**.

| Gate | Status | Retained evidence or required proof |
|---|---|---|
| Repository integrity, tests, typecheck, build, and dependency audit | **PASS** | Clean `main` revision `ee73df1`; full preflight passed on 2026-09-07 with 107 test files / 811 tests passing and zero known dependency vulnerabilities |
| Production database history and security | **PASS** | [Supabase migrations](https://supabase.com/dashboard/project/gwyrfkubdvgemrkkffpr/database/migrations) `001`–`020`; [Security Advisor](https://supabase.com/dashboard/project/gwyrfkubdvgemrkkffpr/advisors/security) zero errors/warnings; [Performance Advisor](https://supabase.com/dashboard/project/gwyrfkubdvgemrkkffpr/advisors/performance) zero findings on 2026-09-07 |
| Shared Workers AI provider configured | **PASS** | Cloudflare Workers AI Read/Write account token installed as a Vercel Production secret; frozen-model API canary returned HTTP 200 and `success: true` on 2026-09-07; token value not retained |
| Production health for the reviewed revision | **PASS** | [Production health](https://locus-five-iota.vercel.app/api/health) returned HTTP 200, `status: "ok"`, revision `ee73df1`, `readiness.missing: []`, and `admission: "invite_only"` on 2026-09-07 |
| Desktop and mobile critical paths | **FAIL** | Production desktop `/` and `/demo` passed, including the complete demo interaction, with no error-level or HTTP 500 logs. On 2026-11-25 the signed-in desktop workspace loaded a Repo, localized a task, and took shared Run `3a8eef4a` to Review-ready. Mobile and signed-in settings/Run-history paths remain to be retained |
| Keyboard and accessibility verification | **FAIL** | Public pages passed on 2026-11-25 at `651300a`: axe-core 4.13.0 (WCAG 2.0 to 2.2 A/AA and best practices) found zero violations on 11 paths at phone and desktop width in both color schemes (44 runs; a control page with planted faults was caught), and Tab reached every control with a visible focus indicator on 6 paths at both widths. Signed-in workspace, settings, and Run history remain to be retained |
| Performance verification | **FAIL** | Public pages measured on 2026-11-25 at `651300a`, lab, phone width with 4x CPU and 1.6 Mbps/150 ms throttling: worst LCP 1.43 s, worst CLS 0.005, worst total blocking time 251 ms (`/`). Within the Core Web Vitals "good" limits. Launch thresholds have not been agreed and signed-in pages remain to be measured |
| Alert delivery | **FAIL** | Retain the intentional `test_alert=true` failure notification and the following healthy production-health run |
| Frozen BYOK and shared-pool canary | **FAIL** | Shared pool passed on 2026-11-25: Run `3a8eef4a`, `shared`, proposal hash `59fe3cbb…de9a`, its named test passing in the Sandbox and again on a clean checkout, frozen criteria shown for review, no external write. Still retain a BYOK Run and a shared-quota denial |
| 24–48 hour one-partner canary | **FAIL** | Retain start/end timestamps and zero Critical incidents, evidence mutations, unexplained quota failures, or external writes |
| Incident and rollback rehearsal | **FAIL** | Retain the operator, timestamps, containment result, compatible deployment revision, health recovery, and lessons |
| Branch and deployment protection | **FAIL** | `main` requires lint-test, typecheck, build, codeql, and gitleaks, includes administrators, and blocks force-push and deletion (2026-11-25). Restricting production deployment to the approved branch/revision remains to be retained |
| Billing-disabled behavior | **FAIL** | Retain signed-in production checks proving no purchase path or paid entitlement is exposed in this launch |
| Final public capability audit | **FAIL** | Record the released `runStart` capability and prove private reads, teams, delivery, billing, autonomous merge, and autonomous deploy remain disabled |

After all rows pass, set a conservative `LOCUS_SELF_SERVE_MAX_ACCOUNTS`, set
`LOCUS_SELF_SERVE=open`, and redeploy the same reviewed SHA. Re-run production
health and the critical path once more before announcing availability.

Private Repo reads, external GitHub delivery, teams, billing, autonomous merge,
and autonomous deployment remain outside this launch. They require separate
capability review and evidence; this record does not authorize them.

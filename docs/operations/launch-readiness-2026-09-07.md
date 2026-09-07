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

## Remaining launch gate

1. Sign in to the launch Cloudflare account and create a narrowly scoped Workers
   AI token with only Workers AI Read and Workers AI Edit.
2. Install `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` in Vercel
   production without printing or retaining their values in source control.
3. Deploy the reviewed release SHA and require `/api/health` to return HTTP 200,
   `status: "ok"`, no missing readiness fields, and the reviewed revision.
4. Run the frozen BYOK and shared-pool canary from
   `free-public-beta-rollout.md`. Retain Run IDs and check evidence, not source or
   credentials.
5. Keep one-partner admission for 24–48 hours with no Critical incident,
   evidence mutation, unexplained quota failure, or external write.
6. Only then set a conservative `LOCUS_SELF_SERVE_MAX_ACCOUNTS`, set
   `LOCUS_SELF_SERVE=open`, and redeploy the same reviewed SHA.

Private Repo reads, external GitHub delivery, teams, billing, autonomous merge,
and autonomous deployment remain outside this launch. They require separate
capability review and evidence; this record does not authorize them.

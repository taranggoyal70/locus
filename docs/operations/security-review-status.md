# Security Architecture Review: implementation status

Tracks the seventeen risks from the Locus Security Architecture Review against
what is actually on `main`. Each entry states what shipped and, where the fix is
partial, what is still missing. A risk marked closed with a residual is not a
risk that was quietly downgraded.

## Closed

| Risk | Priority | Commit | What shipped |
| --- | --- | --- | --- |
| R1 | P0 Critical | `a34ed5d` | Candidate frozen in one capture; reviewed diff built server-side from the trusted base; publishing refused unless `apply(diff, base) == candidate` |
| R2 | P0 Critical/High | `64a60e8` | Egress revoked before any repository-controlled program runs; verification fails closed if the revocation did not take |
| R3 | P0/P1 High | `4b671b8` | Canonical containment inside the sandbox, rejecting symlinks, escapes and non-regular files per path component |
| R5 | P1 High | `74c2e68` | Server-side MCP root allowlist; bounded JSON-RPC framing |
| R6 | P1 High | `528d323` | Widen justification enforced and bound into `proposal_hash`; widened-file ceiling; six sensitive-path classes that fail closed |
| R7 | P1 High | `e024154` | Unscoped tenant queries fail closed; no API route holds a raw service client |
| R8 | P1 High | `72bf003`, `2eb0e18` | Actions SHA-pinned, all-dependency audit, CodeQL, five advisories resolved |
| R11 | P1 High | `032df7f` | Runs refuse to start against a truncated repository |
| R12 | P2 Medium | `c520816` | Context budget clamped; wildcard CORS replaced with an allowlist |
| R15 | P2 Medium | `3a91b80` | Secrets redacted by value shape, not only field name |
| R16 | P2 Medium | `3a91b80` | Security headers pinned by tests rather than living unasserted in config |
| R17 | P3 Medium/Low | `3a91b80` | Webhook body bounded in front of the read (ceiling only, see below) |

Test coverage went from 215 to 353 over this work. The additions are security
regression tests that execute the attacks: a symlinked escape, an MCP root
escape, an oversized JSON-RPC frame, a diff that hides what the candidate
contains, an unscoped tenant query, a widen of a sensitive path.

## Residuals on closed risks

These are real and should not be forgotten because the row above says closed.

- **R1.** Verification still runs in the sandbox the agent edited, so
  verification *evidence* may describe a tree other than the frozen candidate.
  The reviewed diff is always truthful about what will be delivered; "tests
  passed" may not describe those exact bytes. Closing it needs the separate
  verification sandbox described in `candidate-integrity-hardening.md`.
- **R2.** Network phasing shipped; verification-sandbox isolation did not, for
  the same reason. It only becomes meaningful once there is a frozen candidate
  to materialize into a fresh sandbox.
- **R3.** `WorkspaceController.search()` passes Slice paths to `rg`, which does
  not follow symlinks when walking a directory but does read a symlinked path
  given as an explicit argument. The `contain()` guard covers read and write,
  not this path.
- **R3.** `createDiff()` and `changeSet()` invoke `git` directly and sit outside
  containment. Subsumed by the R1 residual.
- **R7.** `src/lib` (rate-limit, api-auth, run-store) and the run workflow still
  use the raw service client. They need different treatment rather than a tenant
  filter: the workflow resolves a run by id *before* it knows the owner, and
  api-auth resolves an API key before it knows the user. Separately, this is not
  the review's literal recommendation, which is a least-privilege database role
  with Clerk to Supabase JWT so RLS applies per user. What shipped removes the
  default cross-tenant failure mode; it does not remove the service role.
- **R17.** The body ceiling shipped. The idempotency ledger did not.

## Open

| Risk | Priority | Why it is still open |
| --- | --- | --- |
| R4 | P0 *before enablement* | Dormant. GitHub connection, private repository reading, and delivery are hard-disabled (`alpha-capabilities.ts`), and migration 011 deleted stored tokens. The fix is to replace the legacy OAuth path with a GitHub App using selected-repository installation and short-lived tokens. Doing that now would build an unused auth path; it must happen **before** delivery is enabled, not after. |
| R9 | P1 High | PDF/DOCX parsing runs inside the web application. Needs a resource-capped, no-network worker and hardened ZIP validation. Real infrastructure work. |
| R10 | P1 High | Workflow runs correlate to the "latest" deployment, and review and legacy-approval semantics still compete. Needs version-pinned workflows and one proposal-hash-bound approval model. |
| R13 | P2 Medium/High | Task text and similar content appear in persistence and analytics and may cross provider boundaries unnecessarily. Changing what is retained is a product and privacy decision, not a mechanical fix. |
| R14 | P2 Medium/High | Model, provider and configuration can drift without a strict production allowlist and privacy profile. Blocked on agreeing the allowlist contents. |

R12's "quota and idempotency races" half is also open: the shipped work covered
the `/v1/locate` budget and CORS, not the atomic-claim logic in the Run creation
path.

## Suggested order

1. **R10**, because competing approval semantics undermine the R1 invariant that
   was just established.
2. **R9**, the largest remaining attack surface reachable by an unauthenticated
   upload.
3. **R4**, immediately before delivery is enabled and not before.
4. **R13** and **R14** once the retention and allowlist decisions are made.

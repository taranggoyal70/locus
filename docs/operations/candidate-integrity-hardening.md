# Candidate integrity and verification isolation (R1, R2)

Status:

- **R2 network phasing — implemented.** Egress is revoked before any
  repository-controlled program runs, and verification fails closed if the
  revocation did not take.
- **R1 candidate integrity — implemented.** The candidate is captured once, the
  reviewed diff is built on the server from the trusted base and those frozen
  bytes, and publishing is refused unless applying that diff to the base
  reproduces the candidate exactly. `reviewDiff()` has been removed.
- **R1/R2 verification isolation — not implemented.** Verification still runs
  in the sandbox the agent edited, so verification *evidence* may describe a
  tree other than the frozen candidate. See "What remains" below.

This records the design and the reason the remainder was not bundled with the
R3/R5/R8 hardening.

R1 and R2 are the two P0 findings from the Locus Security Architecture Review
that cannot be fixed by tightening a check. They require inverting the order of
the Agent Run pipeline. A partial implementation is worse than none: it would
present the appearance of a provenance guarantee without the invariant that
makes it true, and reviewers would trust a diff that still is not bound to the
delivered bytes.

## The attack path, as the code stands today

Confirmed by reading `src/lib/agent/workspace.ts` on `main`:

1. `runCheck()` executes repository-controlled commands — `pnpm test`,
   `pnpm build`, `pnpm exec vitest run`. `validateAgentCommand()` constrains
   *which* command runs, but the command's *contents* are whatever the
   repository ships. Once a check runs, the sandbox is attacker-controlled.
2. `createDiff()` then runs `git add --intent-to-add -- .` followed by
   `git diff --no-ext-diff -- .`. The diff is computed against the sandbox's
   **current, mutable** Git index.
3. `changeSet()` separately re-reads the **current working-tree bytes** of each
   changed path.

Steps 2 and 3 read the tree *after* step 1 had the opportunity to rewrite it,
and they read it twice. So a verification script can:

- write malicious state `B` to an admitted file and stage it into `.git/index`
- rewrite the working file to `C = B + <innocuous-looking edit>`
- leave `git diff` displaying only `B → C`, which reads as trivial
- have `changeSet()` capture the whole of `C`, which still contains `B`

The proposal hash faithfully binds the misleading diff and the complete change
set. What it does not establish is that **applying the reviewed diff to the
trusted base produces the change set**. That is the missing property.

This is an inference from sequencing and Git semantics, not a claim of
exploitation.

## Target sequence

The edit workspace must stop being authoritative the moment editing ends.

```
create sandbox (no customer secrets)            [DONE]
  -> clone at trusted base SHA                  [DONE]
  -> dependency bootstrap        [registry only, --ignore-scripts]   [DONE]
  -> network: DENY-ALL           <-- before any repository-controlled code
                                                [DONE — R2]
  -> agent edits                                [DONE]
  -> freeze + hash candidate                    [TODO — R1]
  -> destroy edit sandbox                       [TODO — R1]
new verification sandbox                        [TODO — R1]
  -> materialize exactly the frozen candidate   [TODO — R1]
  -> run checks                  [network: DENY-ALL, no credentials]
                                                [deny-all DONE; separate
                                                 sandbox TODO]
  -> destroy
server
  -> fetch base tree by immutable GitHub SHA (never sandbox Git state)
                                                [TODO — R1]
  -> build diff server-side from (base, frozen candidate)   [TODO — R1]
  -> ASSERT apply(diff, base) == frozen candidate, byte for byte
                                                [TODO — R1]
  -> publish proposal
```

The security property is not any particular SDK call. It is that the
transition to deny-all happens **before** any repository-controlled program
runs, and is enforced by the platform rather than by shell convention.

### What R2 changed

`AgentWorkspace` gained `lockNetwork()`. On Vercel Sandbox it calls
`sandbox.update({ networkPolicy: "deny-all" })` — verified against
`@vercel/sandbox` 2.9.0, where `update` is the supported entry point and
`updateNetworkPolicy` is deprecated. The revocation is applied by the platform
to a running sandbox, so repository-controlled code cannot undo it from inside
the guest.

`WorkspaceController.runCheck()` now refuses to run unless the lock is
recorded, and the flag is only set after the platform confirms the change. A
failed lock therefore leaves verification blocked rather than silently
permitted — the run aborts and the sandbox is torn down.

Bootstrap remains the only phase with egress. It installs from the frozen
lockfile with `--ignore-scripts` for every package manager, so no dependency
code executes while the network is still reachable.

Still missing, and why it matters: verification runs in the **same** sandbox
the agent edited, so a check can still mutate the tree that `reviewDiff()` and
`changeSet()` later read. Deny-all removes exfiltration and remote payload
fetch; it does not address provenance. That is R1.

## Implementation notes

`FrozenCandidate` is the new boundary type — `baseSha`, per-file
`{path, mode, contentSha256, content}`, `deletedPaths`, and an overall
`candidateSha256`.

Touch points:

| File | Change |
| --- | --- |
| `src/lib/agent/workspace.ts` | Add `freezeCandidate()`. Retire `reviewDiff()`/`changeSet()` as authoritative sources — they read mutable state. |
| `src/lib/agent/vercel-workspace.ts` | Phase the network policy; add a second disposable sandbox for verification. |
| `src/workflows/agent-run.ts` | Reorder: edit → freeze → destroy → verify → server-side diff → publish. |
| `src/lib/agent/github-delivery.ts` | Deliver the frozen candidate bytes, never a re-read of a workspace. |
| new migration | Persist `base_tree_sha`, `candidate_tree_sha256`, `change_set_sha256`, `review_diff_sha256`, `verification_input_sha256`, `verification_evidence_sha256`, `workflow_build_id`, `model_provider`, `model_id`, `policy_version`. Extend `proposal_hash` to bind all of them. |

The existing proposal-hash and immutable-evidence machinery is the right place
to extend. It should not be replaced.

### What R1 changed

`lib/agent/candidate.ts` is the new boundary. `freezeCandidate()` captures the
change set once, hashes each file's exact bytes, and derives an order
independent `candidateSha256` over (base SHA, paths, content hashes,
deletions). `buildDeterministicDiff()` builds the reviewed artifact on the
server from the trusted base tree and those frozen bytes.
`assertCandidateIntegrity()` then refuses to publish unless
`applyCandidateDiff()` — an independent reimplementation, not a reuse of the
candidate — reconstructs every byte.

`WorkspaceController.reviewDiff()` is gone. It derived the human approval
artifact from the sandbox's mutable Git index, which is precisely the state
repository-controlled verification can rewrite. `diff()` survives as an
agent-facing tool only, and says so.

The stored change set is now version 2 and carries `candidateSha256`. Delivery
re-derives that digest from the stored bytes rather than trusting the stored
value, so mutation between approval and delivery fails closed.

**The candidate digest is already bound into `proposal_hash`** without a
migration: `publish_agent_proposal` hashes the full change-set text, and
`candidateSha256` is inside it. A dedicated column would be tidier for
querying, but the integrity property does not depend on one.

### What remains

The residual gap is verification-to-candidate correspondence. Because
verification still runs in the edited sandbox, a check can pass against one
tree while the candidate captured later is a different tree. The reviewed diff
now always tells the truth about *what will be delivered* — but "tests passed"
may describe something else.

Closing it needs the original sequence: freeze, destroy the edit sandbox,
materialize exactly the frozen candidate in a fresh sandbox, and run checks
there with deny-all networking. Also still open: fetching the base tree by
immutable SHA at publish time rather than reusing the localize-time fetch,
which matters once repository truncation (R11) is in play.

## The invariant

```
apply(reviewed_diff, trusted_base_sha) == exact_frozen_candidate
```

This must hold for **every** proposal at publish time, not only in unit tests.
Enforced as a hard precondition, it defeats the whole family of staged-index
tricks, post-verification mutation, and `.git` corruption in one check, because
it makes the reviewed artifact and the delivery payload the same object by
construction.

## Sequencing

R2 (network phasing, separate verification sandbox) should land first. It is
independently valuable, is a smaller change, and removes the "verification can
reach the network" precondition that makes R1 cheap to exploit. R1's freeze
then has a stable sandbox lifecycle to build on.

## Residual items from the R3/R5/R8 pass

Found while implementing the tractable findings; none are fixed:

- **`search()` follows explicitly-named symlinks.** `WorkspaceController.search()`
  passes Slice paths to `rg`. ripgrep does not follow symlinks when walking a
  directory, but it does read a symlinked path given as an explicit argument.
  An admitted path that is a symlink can therefore surface outside file
  contents in search output. The `contain()` guard added for read/write does
  not cover this path.
- **Sandbox `git` operations are unguarded.** `createDiff()` and `changeSet()`
  invoke `git` directly; containment applies to the file tools only. This is
  subsumed by R1 but remains true until R1 lands.
- ~~`prepareDependencies()` runs before network lock-down.~~ Resolved by R2:
  bootstrap is now the only phase with egress, and it installs from the frozen
  lockfile with `--ignore-scripts`, so no dependency code runs while the
  network is reachable.

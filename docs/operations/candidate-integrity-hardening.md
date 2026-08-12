# Candidate integrity and verification isolation (R1, R2)

Status:

- **R2 network phasing — implemented.** Egress is revoked before any
  repository-controlled program runs, and verification fails closed if the
  revocation did not take.
- **R1 candidate integrity — implemented.** The candidate is captured once, the
  reviewed diff is built on the server from the trusted base and those frozen
  bytes, and publishing is refused unless applying that diff to the base
  reproduces the candidate exactly. `reviewDiff()` has been removed.
- **R1/R2 verification isolation — implemented, not yet verified on the
  deployment target.** The candidate is frozen before authoritative checks, the
  edit sandbox is destroyed, and the frozen bytes are materialized into a fresh
  deny-all sandbox where the approved commands run. `src/lib/agent/verification.ts`
  owns the boundary and its sequencing is covered against a fake workspace.
  What has *not* been exercised is the platform behaviour it depends on: a second
  `Sandbox.create`, `deny-all` applied to that sandbox, and materialization of a
  real candidate at real size. Until one live Run confirms those, treat the
  property as implemented rather than proven, and do not cite it as closed. See
  "What remains" below.

This records the design and the reason the remainder was not bundled with the
R3/R5/R8 hardening.

R1 and R2 are the two P0 findings from the Locus Security Architecture Review
that cannot be fixed by tightening a check. They require inverting the order of
the Agent Run pipeline. A partial implementation is worse than none: it would
present the appearance of a provenance guarantee without the invariant that
makes it true, and reviewers would trust a diff that still is not bound to the
delivered bytes.

## The attack path R1 closed

Before R1, the workflow had this sequence:

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

The proposal hash faithfully bound the misleading diff and the complete change
set. What it did not establish was that **applying the reviewed diff to the
trusted base produces the change set**. That is the property R1 added.

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
     (in-loop checks are feedback only, never approval evidence)
  -> freeze + hash candidate before checks      [DONE]
  -> destroy edit sandbox                       [DONE]
new verification sandbox                        [DONE - unverified on platform]
  -> materialize exactly the frozen candidate   [DONE]
     (each write's digest compared on the host against the frozen digest)
  -> run checks                  [network: DENY-ALL, no credentials]
                                                [DONE - refuses to run unless
                                                 the lock is recorded]
  -> destroy                                    [DONE]
server
  -> fetch base tree by immutable GitHub SHA (never sandbox Git state)
                                                [TODO - R11 residual]
  -> build diff server-side from (base, frozen candidate)   [DONE - R1]
  -> ASSERT apply(diff, base) == frozen candidate, byte for byte
                                                [DONE - R1]
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
the agent edited, so a check can still mutate the tree that `changeSet()` later
captures as the candidate. Deny-all removes exfiltration and remote payload
fetch; it does not prove verification-to-candidate correspondence.

## Implementation notes

`FrozenCandidate` is the new boundary type: `baseSha`, per-file
`{path, sha256, content}`, `deletedPaths`, and an overall
`candidateSha256`.

Touch points:

| File | Change |
| --- | --- |
| `src/lib/agent/candidate.ts` | Freeze candidate bytes, compute the candidate digest, build the deterministic review diff, and assert that the reviewed diff reconstructs the candidate. |
| `src/lib/agent/workspace.ts` | Remove `reviewDiff()` as an approval source; keep sandbox `diff()` only as agent-facing progress output and `changeSet()` as the candidate input. |
| `src/workflows/agent-run.ts` | After agent verification, freeze the candidate, build the server-side diff from the fetched base, assert integrity, and publish version 2 change-set content. |
| `src/app/api/agent/runs/[id]/approve/route.ts` | Require the submitted proposal hash and recheck the stored candidate digest before delivery. |

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

Verification-to-candidate correspondence is now implemented:
`verifyFrozenCandidate()` refuses to run unless the sandbox network is locked and
the candidate digest re-derives from its own contents, materializes every frozen
byte, compares each write's digest **on the host**, and aborts if a deletion did
not take. `verifyDetail` records the `candidateSha256` the evidence was produced
against, so a reviewer can tell which tree was tested. Failures abort the Run
rather than downgrading to the edit sandbox's result.

Three things are genuinely still open:

- **Platform behaviour is unexercised.** A second `Sandbox.create`, `deny-all`
  on that sandbox, and materializing a real candidate have only been tested
  against a fake workspace. One live Run is what turns this from implemented into
  proven, and the status above says so deliberately.
- **Cost and latency roughly double per Run.** Two sandboxes, two dependency
  bootstraps. There is no cheaper correct shape: once repository-controlled code
  has run, the sandbox it ran in cannot be the source of evidence about anything.
- **The base tree is still the localize-time fetch**, not a fresh fetch by
  immutable SHA at publish time, which matters once repository truncation (R11)
  is in play.

`changeSet()` still enumerates changed paths with sandbox `git` in the edit
sandbox, and that enumeration now happens before any authoritative check runs.
It is still repository-influenced: a check the agent ran in-loop could have
touched the index first. The materialization digest check bounds the damage — the
candidate that gets tested and delivered is exactly the bytes that were frozen —
but the *set* of paths is not yet established independently of sandbox Git.

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

Network phasing and candidate integrity have landed. The remaining sequencing
work is verification isolation: freeze the candidate before checks, destroy the
edit sandbox, materialize those exact bytes into a fresh sandbox, and verify
there under deny-all networking.

## Residual items from the R3/R5/R8 pass

Found while implementing the tractable findings; none are fixed:

- **`search()` follows explicitly-named symlinks.** `WorkspaceController.search()`
  passes Slice paths to `rg`. ripgrep does not follow symlinks when walking a
  directory, but it does read a symlinked path given as an explicit argument.
  An admitted path that is a symlink can therefore surface outside file
  contents in search output. The `contain()` guard added for read/write does
  not cover this path.
- **Sandbox Git enumeration remains part of candidate capture.** `changeSet()`
  invokes `git` directly in the edited sandbox to enumerate changed paths
  before `freezeCandidate()` hashes the file bytes. R1 removed sandbox Git from
  the human diff, but verification isolation is still needed before this read
  can be treated as the exact tree that was tested.
- ~~`prepareDependencies()` runs before network lock-down.~~ Resolved by R2:
  bootstrap is now the only phase with egress, and it installs from the frozen
  lockfile with `--ignore-scripts`, so no dependency code runs while the
  network is reachable.

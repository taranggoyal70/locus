# Locus Guard runner v1

Status: implementation contract
Date: 2026-09-07
Fixed point: `99bbdebfbad66a50612c5bfb81db992ebc7696a7`

## Outcome

Turn a trusted Guard scope manifest into a runnable, fail-closed boundary for a
local coding agent. A successful Run leaves a reviewable working-tree candidate
and a signed receipt that binds the exact candidate, containment backend,
executed Checks, factual usage, and human Review state.

## Public interfaces

The public test seams are:

1. `locus guard run`, observed through its exit status, working-tree candidate,
   and signed receipt.
2. `locus guard receipt verify`, observed using an independently held public
   key and expected signer key ID.
3. `locus guard review`, observed as an immutable decision bound to the exact
   prior review-ready proposal hash.

## Required behavior

### Contained execution

- Materialize only the manifest's currently admitted Slice in a temporary
  workspace. Do not place Git objects, excluded files, Guard control artifacts,
  or original absolute paths in that workspace.
- Run `codex`, `claude`, or an explicit command adapter in an OS sandbox.
- On macOS, Seatbelt must deny every read and write beneath the original Repo
  and allow writes only in the isolated workspace/runtime. On Linux, Bubblewrap
  must make the original Repo unavailable and the host filesystem read-only.
- Refuse to run when a supported containment backend is unavailable. There is
  no uncontained fallback.
- Treat new paths, symlinks, special files, and any change outside the admitted
  Slice as violations. Apply no candidate change when a violation exists.
- Recheck manifest integrity, repository identity, frozen base, clean checkout,
  and unchanged HEAD immediately before applying the candidate.

The v1 boundary constrains access to the target Repo and host writes. It does
not claim to hide unrelated readable host files from the agent, isolate the
network, or protect credentials the chosen provider CLI itself requires.

### Agent adapters

- Codex runs non-interactively with JSONL output and its own workspace-write
  policy inside the outer Locus boundary.
- Claude runs non-interactively with JSON output, a non-persistent session, and
  customizations disabled inside the outer Locus boundary.
- The command adapter is vendor-neutral and executes only the argv explicitly
  supplied after `--`.
- The prompt is never stored verbatim in a receipt; store its SHA-256 and byte
  length.

### Evidence

- Inspect the exact uncommitted candidate, including untracked files, using a
  deterministic content record per changed Repo-relative path.
- Run every declared Check in the original Repo only after the candidate passes
  path enforcement. Record command, exit status, duration, output byte lengths,
  output digests, and bounded relevant output.
- Parse provider-reported token and cost fields when present. Mark unavailable
  values as unavailable; never estimate or invent cost.
- A Run passes only when containment succeeded, the agent exited zero, at least
  one admitted path changed, no path violation occurred, and every Check passed.

### Signing and Review

- Generate Ed25519 key pairs without dependencies. Refuse to place a private
  key inside the target Repo.
- Sign canonical JSON, include the public-key fingerprint as `keyId`, and write
  the envelope using symlink-safe Guard artifact handling.
- Offline verification requires the independently supplied public key and may
  additionally require an expected key ID.
- A human Review is `accepted` or `rejected`, records actor, time, criteria, and
  notes, and binds `proposalHash` to the signed pending-review receipt. Updating
  a reviewed receipt is not allowed; a new Run is required.

## Explicit non-goals

- The runner does not prove the Agent Task is correct.
- It does not silently Widen the Slice.
- It does not commit, push, open a pull request, deploy, or approve delivery.
- A signature proves integrity and signer possession, not signer identity,
  unless the verifier trusts the expected public key out of band.

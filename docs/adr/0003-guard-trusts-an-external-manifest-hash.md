# ADR-0003: Guard trusts an external manifest hash

Date: 2026-09-07
Status: accepted

## Context

A Guard scope manifest stored only in an agent's checkout is self-asserted. An agent
with normal filesystem access can change the allowlist and recompute its hash.
Checking that self-hash would detect accidental corruption but would not make a
merge decision authoritative.

Different agent hosts also provide different containment guarantees. Locus
cannot truthfully claim that an MCP response, an ignore file, or a best-effort
hook physically prevents reads outside a Slice.

## Decision

Locus Guard separates guidance, enforcement, and integrity:

- `guard init` creates a canonical Guard scope manifest from a deterministic
  Slice and prints its SHA-256.
- An authoritative `guard verify` requires the expected manifest hash from a
  trusted channel outside the candidate branch and the expected candidate SHA
  from the pull-request event. A missing or different value fails closed.
- `--advisory` may use a self-asserted manifest for local feedback, but its
  receipt says `advisory` and `self-asserted`.
- Each Widen records the path, reason, decision, actor, timestamp, prior event
  hash, and event hash. The current scope is derived from the initial scope and
  this append-only chain.
- Verification requires a clean Git checkout, binds the binary diff from the
  frozen base to the exact candidate SHA, and exits non-zero for any changed
  path outside the admitted Slice.
- The Guard receipt omits wall-clock generation time so identical trusted
  inputs produce identical JSON and a stable receipt hash. Signing systems may
  add an issuance time outside the deterministic receipt.
- The receipt is unsigned by default. It is suitable as the subject of a
  Sigstore or GitHub artifact attestation, but a signature proves provenance
  and integrity rather than correctness or task completion.

## Consequences

- The pilot needs a small trusted control plane: an organization variable,
  protected environment value, GitHub App record, or equivalent place to retain
  the expected manifest hash.
- A manifest cannot quietly widen itself on the candidate branch. Approved
  Widens must update the trusted hash before the merge gate can pass.
- The merge gate constrains what may be merged. Until a documented adapter
  provides fail-closed filesystem containment, product copy must not say Guard
  prevented an agent from reading a file.
- Candidate verification is portable across agents because it depends on Git
  and the manifest contract rather than one host's hook format.

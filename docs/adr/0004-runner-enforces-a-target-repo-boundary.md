# ADR-0004: Guard runner enforces a target-Repo boundary

Date: 2026-09-07
Status: accepted

## Context

The v0.3 merge gate rejects candidate paths outside a trusted Slice, but an
agent with ordinary host access may still read every file in the Repo and may
attempt unrelated writes before the final Git check. Provider permission files
are useful policy hints, not a vendor-neutral fail-closed boundary.

## Decision

`guard run` materializes the admitted Slice into an ephemeral workspace and
executes the provider CLI inside an operating-system containment backend. The
original Repo is inaccessible to the child process. Host writes are limited to
the ephemeral workspace/runtime. Locus refuses the Run if a backend is absent.

The first backends are macOS Seatbelt and Linux Bubblewrap. Both constrain the
target Repo, but v1 does not claim to conceal all other host-readable data or to
isolate the network. Provider credentials are copied only into the ephemeral
runtime when their CLI needs them and are removed with that runtime.

Only a path-clean candidate is copied back, after the original Repo and HEAD are
revalidated. Checks run afterward as trusted user commands in the original
Repo, and their factual results are signed with the candidate receipt.

## Consequences

- Locus can truthfully say the supported runner prevents the agent process from
  reading or writing outside its Slice in the target Repo.
- Unsupported platforms and missing Bubblewrap fail closed.
- A malicious agent may still read unrelated host data that the OS profile
  permits and may use the network. Strong whole-host isolation belongs in a
  disposable VM/container service, not in this local v1 claim.
- Signing needs a separately protected Ed25519 private key; self-generated keys
  establish integrity only when the verifier trusts the public key out of band.

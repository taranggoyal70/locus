# ADR-0002: Separate review readiness from external delivery

Date: 2026-08-03
Status: accepted

## Decision

A Run may produce a **Review-ready proposal** without gaining permission to write to an external
repository. GitHub delivery is a separate capability that requires approval bound to the exact
reviewed Artifact, an unexpired decision, a fresh base revision, idempotent delivery, and recovery
when the external write succeeds before local finalization. Until those invariants exist, Locus
stops at human review and disables external writes in both the server interface and the UI.

## Consequences

- Passing checks can advance a Run to review, but cannot imply delivery or task correctness.
- Product copy and status labels must distinguish review readiness from approval and completion.
- A future GitHub adapter must sit behind the Run module's guarded delivery seam.
- Autonomous merge and deployment remain outside the product boundary.

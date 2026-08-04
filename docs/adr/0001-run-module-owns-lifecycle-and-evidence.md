# ADR-0001: The Run module owns lifecycle and evidence semantics

Date: 2026-08-01
Status: accepted

## Context

Run lifecycle mutation, Step persistence, token arithmetic, approval completion,
and client snapshot types were spread across the durable workflow, route
handlers, and React state. This allowed completed Steps to overwrite running
Steps, terminal state to be rewritten directly, failed Runs to display savings,
and refresh to lose the active Run.

## Decision

The Run module is the seam for lifecycle and evidence semantics.

- `run-state.ts` owns valid transitions, terminal immutability, and Savings
  claim eligibility.
- `run-store.ts` owns guarded persistence, append-only Step writes, atomic
  proposal publication, and artifact-bound Review decisions.
- `run-view.ts` defines the Run evidence snapshot shared by server and client.
- Run status is the live projection; Steps are immutable completed evidence.
- Only a completed Run may expose a Savings claim.

Lifecycle and evidence snapshot semantics remain one module initially because
splitting them would duplicate the verified-outcome rule across two interfaces.

## Consequences

- Workflow and delivery callers must name the expected current status.
- Concurrent or stale transitions fail instead of silently rewriting state.
- Failed Runs retain factual usage without presenting a Savings claim.
- The Run module becomes the test surface for future retry, cancellation,
  approval, and delivery recovery work.
- Multi-table atomic finalization remains follow-up work for the Postgres adapter.

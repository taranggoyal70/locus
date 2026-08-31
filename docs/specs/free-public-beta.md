# Free public beta

Status: implementation-ready  
Date: 2026-08-30

## Outcome

Launch Locus as an honest, self-serve, zero-inference-spend beta without
presenting a small provider allowance as unlimited production capacity.

## Requirements

1. Signed-in users may start Agent Runs when the operator explicitly enables
   the public beta. Existing invite-only behavior remains the safe default.
2. The shared beta uses Cloudflare Workers AI model
   `@cf/qwen/qwen3.8-27b`, one Run at a time and at most one admitted shared Run
   per UTC day across the deployment. Shared Runs have a 100,000-token ceiling;
   user-owned Runs keep the configured bounded Run ceiling.
3. A user may optionally connect their own Cloudflare Account ID and Workers AI
   API token. BYOK Runs do not consume the shared daily slot, but remain subject
   to the existing per-user and concurrency controls.
4. Provider tokens are accepted only by an authenticated, same-origin server
   route, encrypted with AES-256-GCM before persistence, never returned after
   submission, and removable by the owner. Logs, analytics, workflow arguments,
   Steps, and Artifacts must not contain credentials.
5. Provider and execution mode are frozen on each Run. A durable workflow must
   resolve only the reviewed Cloudflare model and must fail closed if the
   matching shared or user credential is unavailable.
6. The workspace explains the shared limit in plain language, lets a user choose
   shared capacity or their connected account, and links an unconfigured BYOK
   user to Settings.
7. Settings provides a nontechnical Cloudflare connection flow and exposes only
   connection status after saving.
8. Consent, Privacy, Terms, health checks, environment documentation, rollout
   instructions, and operational failure copy must name Cloudflare Workers AI
   and the limited-free-beta boundary accurately.
9. Existing Sandbox isolation, Slice/Widen controls, token and time budgets,
   append-only evidence, human Review, and disabled external writes remain
   unchanged.
10. The change includes behavioral tests for public admission, provider/model
    resolution, credential encryption, shared daily quota, request validation,
    settings UI, workspace UI, and production readiness.

## Non-goals

- Unlimited free Agent Runs.
- Silent provider fallback.
- Private Repo access, autonomous GitHub writes, merge, or deployment.
- Supporting arbitrary user-selected providers or models in this release.
- Persisting provider keys in browser storage or durable workflow arguments.

## Launch gate

Production remains closed until the database migration is applied and the
shared Cloudflare Account ID/API token plus credential-encryption key are
installed. The first public claim must follow a successful frozen canary on the
same production revision.

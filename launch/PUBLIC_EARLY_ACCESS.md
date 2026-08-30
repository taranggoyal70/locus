# Public early-access launch

## Release contract

The public launch opens account creation and self-serve localization for supported public JavaScript and TypeScript Repos. It does not open unrestricted Agent Runs. Agent execution remains invite-gated by `ALPHA_ALLOWED_USER_IDS`, which is the cost, safety, and rollback control.

The launch must not claim autonomous task completion, verified token savings, private-Repo support, billing, teams, or external GitHub delivery.

## Go/no-go gates

- Production `/api/health` returns `200`, the current `main` revision, no missing readiness dependency, and `webhook` or `external_health_check` alerting.
- The scheduled `Production health` workflow has completed successfully against the production revision.
- CI, CodeQL, dependency audit, production build, browser smoke test, accessibility, and mobile Lighthouse are green.
- Supabase migration history is contiguous through `017`, the dry run is empty, and database advisors report no findings.
- Privacy, terms, support, retention, incident response, and rollback instructions describe public early access accurately.
- Agent Runs remain restricted to the current approved users until the Release 1 human-evidence and canary gates pass.

## Staged rollout

1. Publish the website and repository announcement. Keep Agent Run admission unchanged.
2. Monitor health, 5xx rate, client errors, Repo loads, and access requests for 24 hours.
3. Invite at most one additional Agent Run design partner. Hold for another 24–48 hours.
4. Increase the invite set only when error rate remains within 10% of baseline, p95 latency remains within 20%, and no new client-error type appears.
5. Do not announce unrestricted Agent Runs until the frozen 40-arm Release 1 evaluation and two human-accepted design-partner Runs are complete.

## Launch-day sequence

1. Confirm the production SHA and run the production-health workflow manually.
2. Publish `launch/LINKEDIN_POST.md` and place the live and GitHub links in the first comment if the platform suppresses link posts.
3. Respond to every access request or public question during the launch window.
4. Check production health and Vercel errors at 15, 30, and 60 minutes, then every four hours on day one.
5. Record signups, successful Repo loads, Agent Run access requests, client errors, and support reports without copying task or repository content.

## Success and rollback thresholds

Advance when production has no new client-error type, no Critical incident, and error/latency remain inside the thresholds above. Engagement is directional during early access; do not manufacture a minimum conversion claim from a small sample.

Immediately pause Agent Run admission by clearing `ALPHA_ALLOWED_USER_IDS` when error rate exceeds twice baseline, p95 latency rises more than 50%, evidence integrity is questioned, a security issue is reported, or provider cost/quota is not understood. Roll application code back to the prior production deployment, leave additive migrations installed, verify health and the browser path, and publish a factual status update.

## Prepared channel copy

Short post:

> Locus public early access is live. Give it a real JavaScript or TypeScript task and a public Repo; it builds a task-sized Slice and shows every Included, Excluded, and Widened file. Localization is open to signed-in users. Complete Agent Runs are still invite-gated while I collect human review evidence. Try it: https://locus-five-iota.vercel.app

GitHub release summary:

> Public early access opens self-serve public-Repo localization, adds independent production monitoring, and keeps complete Agent Runs behind the existing admission control. Claims remain limited to the published historical localization suite.

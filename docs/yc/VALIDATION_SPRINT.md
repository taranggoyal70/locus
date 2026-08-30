# Locus API-migration validation sprint

**Start:** As soon as founder availability is confirmed  
**Duration:** 14-day validation gate, followed by four weeks of execution only if demand is real  
**Primary metric after validation:** weekly merged API migration pull requests

## Sprint rule

For the first 14 days, manual work is a feature. The goal is to learn whether API providers and maintainers want the outcome, not to prove that every step is automated.

Do not open a pull request, request repository access, or process private code without explicit maintainer authorization.

## Days 1–2: choose real migrations

Select three API or SDK ecosystems with:

- a recent breaking change, deprecation, or security migration;
- a public migration guide, changelog, schema diff, or codemod;
- at least 20 discoverable public dependent repositories;
- an identifiable developer-relations, SDK, or support owner;
- a change narrow enough to demonstrate safely.

Create one evidence sheet per ecosystem:

- old API pattern;
- new API pattern;
- edge cases and exclusions;
- verification command;
- ten affected public repositories;
- provider contact and maintainer contact;
- estimated support or adoption cost to investigate in interviews.

## Days 3–7: concierge proof

For at least ten public repositories:

1. locate the affected call sites;
2. compile an evidence-backed change boundary with Locus;
3. prepare the migration patch manually or with the current agent-run system;
4. run repository tests and static checks where practical;
5. produce a reviewer packet showing intended scope, actual scope, checks, and uncertainty;
6. record time, token cost, failures, widening events, and human corrections;
7. show the result privately to the provider or maintainer before opening any pull request.

The deliverable is not ten screenshots. It is ten repository-specific patches that another maintainer could review.

## Days 3–10: interviews

Target:

- 15 API/SDK provider conversations;
- 10 maintainer conversations;
- at least five conversations about a migration completed in the last 90 days.

Ask providers:

1. Tell me about the last breaking change or deprecation you shipped.
2. How did you find which customers or repositories were affected?
3. What support tickets or adoption delays resulted?
4. Who owned the migration and how much engineering time did it consume?
5. Did you use a codemod? Where did it fail?
6. Would you allow us to prepare patches against public repositories for this change?
7. If those patches were correct, who would pay and from what budget?
8. What security or consent conditions would block a private-repository pilot?

Ask maintainers:

1. How did you learn about the change?
2. How long did the last migration take?
3. What made you trust or distrust automated patches?
4. What evidence would make a provider-authored pull request reviewable?
5. Would you authorize a patch for this repository? Why or why not?

Do not ask whether the idea is “cool” or whether they would hypothetically use it.

## Outreach messages

### Provider

> Hi [name] — when [SDK/API] ships a breaking change, how do you find affected customer code and help teams migrate? I'm building Locus, which turns a changelog or schema diff into verified migration patches. I found [specific public usage] affected by [specific change]. I'll prepare one migration against public repositories and show you the result; no access is needed. Could I ask about the last migration your team supported for 20 minutes?

### Maintainer

> Hi [name] — I found that [specific usage] in [repository] may be affected by [specific API change]. I'm testing a tool that prepares a small verified migration patch and explains every changed file. I will not open a pull request without your approval. Would you be willing to review the patch privately first?

### Paid pilot follow-up

> We completed [number] representative patches for [migration], with [number] passing their repository checks and [number] maintainer-approved. I can run a four-week pilot for [scope] at [$ amount], including maintainer consent, patch verification, and a weekly outcome report. If that is useful, who owns the budget and security review?

## Day 14 decision

### Continue the wedge when

- three providers agree to a concrete pilot, or two show credible payment intent;
- five maintainers authorize live patches;
- at least 30% of providers rank the problem among their top three developer-support or adoption pains;
- a repeated migration pattern exists across repositories;
- providers accept responsibility for contacting or sponsoring their customer migrations.

### Stop or change the wedge when

- interest is polite but nobody supplies a real migration;
- maintainers broadly reject provider-initiated patches;
- every repository requires bespoke work with no reusable evidence or transformation;
- the buyer cannot be identified;
- the perceived problem is documentation quality rather than migration execution;
- security requirements make a pilot impossible before trust exists.

If the wedge fails, interview TypeScript engineering teams about the alternative: reviewer evidence packets for agent-generated pull requests. Do not keep building API-specific features to rescue a failed demand test.

## Weeks 3–6: build only the bought workflow

If the gate passes, implement the narrowest repeatable path:

1. provider change intake: changelog, API diff, schema, and verification rules;
2. affected-repository discovery or provider-supplied repository list;
3. GitHub App authorization with explicit repository consent;
4. Locus context boundary and controlled widening;
5. patch generation and repository checks;
6. review packet and draft pull request;
7. provider and maintainer approval before publication;
8. outcome tracking: opened, corrected, merged, rejected, and time-to-merge.

Defer generalized dashboards, multi-language breadth, broad agent orchestration, and self-serve billing.

## Six-week targets

Targets are learning thresholds, not claims:

- three paid provider pilots;
- 25 real migration pull requests prepared;
- 10 pull requests merged;
- three providers using Locus in at least two separate weeks;
- one measured case study showing support time, migration time, or adoption improvement;
- the frozen 40-arm agent evaluation completed;
- zero unauthorized pull requests and zero private-code exposure.

## Weekly evidence ledger

Record each week:

| Metric | Definition |
| --- | --- |
| Provider conversations | Unique API/SDK providers discussing a recent real migration |
| Authorized repositories | Repositories whose maintainers or owners approved patch preparation |
| Patches prepared | Repository-specific changes with verification evidence |
| Pull requests opened | Authorized patches published for review |
| Pull requests merged | Published migration changes merged by maintainers |
| Repeat providers | Providers active in two or more distinct weeks |
| Revenue collected | Cash received, excluding verbal intent and credits |
| Human corrections | Patches requiring scope or implementation changes |
| Median migration time | Start of work to review-ready patch |
| Security incidents | Unauthorized access, code exposure, or consent failures |

Update the YC application only with evidence recorded here. The useful story is not that the plan was completed; it is what customers did and paid for afterward.

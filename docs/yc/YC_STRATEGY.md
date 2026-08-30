# Locus YC strategy

**Decision date:** August 30, 2026  
**Status:** Working strategy; probabilities are subjective estimates, not YC statistics.

## The honest assessment

YC says it receives more than 10,000 applications every three months and typically accepts about 1% ([YC investor resources](https://www.ycombinator.com/investors)). Based on the evidence currently visible in this repository, Locus's estimated chance if it applied today is **0.5–2%**.

That estimate is not a judgment that the product is weak. Locus demonstrates that the founder can build and ship: the public product is live, the repository has hundreds of commits, the launch checks pass, and its claims are unusually careful. The problem is that the current evidence proves engineering execution, not urgent customer demand.

The current gaps are:

- no external active teams or paying customers visible in product data;
- no real customer pull requests completed with Locus;
- the frozen Release 1 agent evaluation is still at 0/40 runs;
- the published benchmark is small and uses repositories owned by the founder;
- the horizontal agent-context category is crowded and the pitch can sound like a feature an IDE or agent vendor will absorb;
- founder commitment, equity, legal structure, and strongest personal achievements are not established in the repository.

YC funds idea-stage and pre-revenue companies, so zero revenue is not disqualifying. YC says roughly 40% of funded companies are idea-stage and most have no revenue ([YC FAQ](https://www.ycombinator.com/faq)). But without traction, the founder insight and founder story must be exceptional and specific.

## The strategic change

Do not lead with:

> Locus reduces context for coding agents.

Lead with a painful completed job:

> **Locus is Dependabot for breaking API changes. API companies give Locus a changelog or schema diff; Locus finds affected customer code, creates verified patches, and opens review-ready pull requests.**

Then explain the technical advantage:

> Underneath, Locus compiles each migration task and repository into an inspectable execution boundary. Every included file has evidence, excluded code stays unavailable, and scope expansion is recorded.

This is a proposed wedge, not a claim that the product already does all of it. It should be validated before the public website is rewritten.

## Why this wedge is stronger

### It names a buyer

The initial buyer is an API or SDK company whose team bears the support and adoption cost of customer migrations. One provider can introduce Locus to many repositories, which is a better distribution structure than acquiring individual developers one at a time.

### It names an expensive event

Breaking changes, deprecations, security migrations, and SDK upgrades create support tickets, delayed adoption, and churn risk. The outcome is observable: a migration pull request is opened, reviewed, and merged.

### It gives Locus a clear success metric

The primary metric becomes **weekly merged API migration pull requests**, not estimated context reduction.

### It fits the existing product

Locus already has useful foundations for this workflow:

- task-to-code localization;
- evidence-backed file selection;
- dependency analysis;
- isolated agent execution;
- exact-commit and proposal evidence;
- controlled widening and review records.

### It is timely without being a trend-only pitch

YC's Fall 2026 Requests for Startups includes “Self-Maintaining APIs”: API providers should identify affected customer code and open migration pull requests instead of only publishing a changelog ([YC Requests for Startups](https://www.ycombinator.com/rfs)). An RFS does not improve the odds by itself, but it confirms that this customer problem is legible to YC.

## Positioning hierarchy

1. **Company outcome:** verified migration pull requests for API changes.
2. **Initial customer:** API and SDK providers with developer customers.
3. **Technical insight:** reliable agent work starts with semantic code admission, not merely better generation.
4. **Underlying platform:** a portable context compiler and evidence ledger for coding agents.
5. **Future expansion:** security migrations, framework upgrades, large refactors, and other provider-sponsored code changes.

This order keeps the application concrete while preserving the larger platform opportunity.

## Two-week decision gate

Do not spend two months building the pivot before testing it. Run the first two weeks as a concierge service.

Continue with the API-migration wedge only if, by day 14, at least one of these demand conditions is true:

- three API/SDK providers agree to a real pilot;
- two providers give credible payment intent and a specific migration to run;
- five maintainers authorize a patch against a live repository.

Also require:

- at least 30% of interviewed providers describe migration/support as a top-three problem;
- at least one migration pattern repeats across several repositories;
- Locus can produce a useful patch without unsafe or overly broad repository access.

If those conditions fail, preserve the core context-compiler technology and test the narrower team-review wedge described in the [primary-source memo](../research/yc-readiness-primary-sources.md): evidence packets for teams reviewing agent-generated pull requests.

## Probability milestones

These are directional ranges, not forecasts.

| Evidence at application time | Subjective final acceptance chance |
| --- | ---: |
| Current evidence: live product, no external traction | **0.5–2%** |
| Three paid pilots, 25 real migration/review PRs, paired evaluation complete | **2–5%** |
| Five to ten paying teams, repeat weekly use, clear measured customer outcome | **potentially above 5%**, still highly uncertain |

Founder facts can move these ranges materially. A specific exceptional achievement, a convincing reason for pursuing this problem, full-time commitment, or relevant customer access could strengthen the application. Ambiguous commitment or inflated claims would weaken it.

## Application timing

YC is accepting late applications for Fall 2026 ([YC Apply](https://www.ycombinator.com/apply)). Apply late now only if the founder can commit full-time if accepted and can submit a truthful application and founder video within a few days. Use the current product as the demo and describe API migrations as the initial workflow being tested—not as proven traction.

Otherwise, run the six-week evidence plan and apply to the next batch. YC says repeat applications are common and progress since a previous application is a strong signal ([YC FAQ](https://www.ycombinator.com/faq)).

## What not to build yet

- a broad multi-agent orchestration platform;
- billing infrastructure before anyone agrees to pay;
- integrations for every language or IDE;
- private-repository infrastructure beyond the minimum required for a signed pilot;
- dashboards without a recurring customer workflow;
- more benchmark cases instead of the already-frozen paired agent evaluation;
- a rewritten public brand before the wedge passes the decision gate.

The next scarce resource is customer evidence, not another feature.

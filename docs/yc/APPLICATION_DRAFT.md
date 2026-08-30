# YC application draft for Locus

**Draft date:** August 30, 2026  
**Rule:** Replace every bracketed field with a truthful answer. Do not submit placeholders or imply that pilots, revenue, or product capabilities exist before they do.

## Company description

### What does your company make?

Today, Locus compiles a software task and a public JavaScript or TypeScript repository into an evidence-backed context boundary for a coding agent. It identifies the relevant code, keeps excluded files unavailable during a run, and records scope and proposal evidence against an exact commit.

I am now validating the first paid workflow: turning an API change and a customer repository into a verified migration pull request. The intended flow is that an API company supplies a changelog, SDK diff, or schema change; Locus finds affected code, creates the patch, runs the required checks, and gives the maintainer evidence explaining the scope. That migration workflow is not yet validated or fully automated.

### Product link

<https://locus-five-iota.vercel.app/>

### Demo

Use the current public-repository flow. In 60–90 seconds:

1. paste a real public GitHub repository and a concrete change request;
2. show Locus producing the relevant file set and its evidence;
3. show that excluded files are not available to the run;
4. show a proposal or run record pinned to an exact commit;
5. state plainly that provider-driven API migrations are the first customer workflow now being validated.

Do not spend demo time on the landing page, architecture, test count, or future features.

## Founders

### Who are the founders?

Tarang Goyal — [FOUNDER INPUT REQUIRED: current role, education if relevant, location, and one sentence of specific technical or market credibility].

### Are all founders able to attend the batch and work full-time afterward?

[FOUNDER INPUT REQUIRED: answer yes or no, current obligations, and exact date full-time work begins.]

### How long have the founders known one another and how did they meet?

Solo founder.

YC says it accepts solo founders but believes startups are generally more likely to succeed with a co-founder ([YC FAQ](https://www.ycombinator.com/faq)). Do not add a co-founder for the application. Add one only if there is a high-trust person with complementary ability who is already doing founder-level work.

### Most impressive achievement

[FOUNDER INPUT REQUIRED. Use one achievement with numbers, stakes, personal contribution, and why it was unusually difficult. Verify any hackathon, employment, adoption, revenue, research, or award claim.]

Weak version: “I am a 7x hackathon winner.”

Better structure: “I [built/led/did X] in [time constraint], competing against [number or level], and achieved [verifiable result]. I personally [hard part].”

YC calls this one of the most important application questions ([YC, How to Apply](https://www.ycombinator.com/howtoapply)).

### An impressive system you hacked or non-computer system you improved

[FOUNDER INPUT REQUIRED: a concrete story showing resourcefulness. Do not force Locus into this answer unless it genuinely fits.]

## Progress

### How far along are you?

I built and publicly launched an early-access version in about seven weeks. It localizes JavaScript and TypeScript tasks in public GitHub repositories, produces evidence for the selected scope, and can run an agent inside that boundary. The production launch checks pass and the repository contains more than 500 automated tests.

The current public benchmark has 15 author-owned cases. It retained every expected fix file in those cases and estimated a median 53% context reduction, but it is not independent evidence and I do not present it as proof of customer value. I froze a 40-arm paired agent evaluation, but it currently has 0 completed runs.

I have [0 / FOUNDER INPUT REQUIRED] external active teams, [0 / FOUNDER INPUT REQUIRED] paying customers, and [$0 / FOUNDER INPUT REQUIRED] revenue. I am now testing API migration pull requests as the first paid workflow.

### How long have you worked on this? How much was full-time?

[FOUNDER INPUT REQUIRED: start date, weeks full-time, weeks part-time, and other commitments.]

### How many active users or customers do you have?

[FOUNDER INPUT REQUIRED. Report people or teams who used the product for real work, the time window, repeat use, and any paid pilots. Exclude the founder's own test activity and waitlist signups.]

### Do you have revenue?

[FOUNDER INPUT REQUIRED. If none, say “No.” Do not describe credits, verbal interest, or unpaid design partners as revenue.]

### What are your next milestones?

Over the next six weeks I will:

- interview at least 15 API/SDK providers and 10 repository maintainers;
- run API migrations manually before automating the workflow;
- secure three paid pilots;
- complete at least 25 real migration pull requests, with at least 10 merged;
- complete the frozen paired evaluation and report task success, cost, latency, false exclusions, and scope widening;
- measure repeat weekly use and provider support time saved.

## Idea

### Why did you choose this idea?

Coding agents are getting better at generating code, but teams still cannot reliably inspect what repository context shaped a change. Tests show whether code runs; they do not show whether the agent understood the requested boundary or searched irrelevant and sensitive areas.

My non-obvious insight is that search optimizes for finding more potentially relevant code, while reliable agent work needs **semantic code admission**: the smallest evidence-backed boundary allowed for one task, plus an explicit mechanism to widen it. API migrations are the first workflow where that boundary has a clear buyer and measurable result.

[FOUNDER INPUT REQUIRED: add the real event, observation, or repeated frustration that led to this insight.]

### Who needs this?

Initially, API and SDK companies shipping deprecations, breaking changes, security migrations, or new major versions. Their developer-relations, support, and engineering teams currently publish migration guides and wait for customers to do the work. Locus lets the provider deliver a review-ready patch instead.

The end user is the maintainer reviewing that pull request. The provider is the initial buyer.

### How do you know people need it?

Current honest answer:

> I do not know yet. The product exists, but I have not established customer pull. I am testing the thesis with recent real migrations and will continue only if providers authorize pilots or offer to pay.

Replace this answer only with specific evidence: the last migration discussed, support volume, pilot scope, payment, and repeat use.

### Competitors and differentiation

Coding agents, IDEs, code-search systems, and code-review tools all overlap with parts of Locus. Examples include Morph for agent code search and compaction, Greptile for codebase-aware review, and code-graph products for repository understanding.

They primarily help an agent understand more code or review a completed diff. Locus currently compiles the allowed task boundary before and during execution, withholds excluded code, and records scope evidence. The proposed migration workflow would connect that evidence to a specific migration outcome and test a different distribution model in which an API provider sponsors changes across customer repositories.

The risk is that this remains a feature rather than a company. The test is whether providers repeatedly pay for completed migrations and whether the task-to-scope-to-human-decision data improves results across repositories.

### How will you make money?

Charge API and SDK providers for successful migrations across customer repositories. Start with a paid pilot priced at [FOUNDER INPUT REQUIRED: proposed price, suggested test range $500–$2,000 per month or a fixed fee per migration campaign]. After measuring workload and value, test subscription tiers based on active repositories or completed migration pull requests.

Do not present the price as validated until a customer pays it.

### Why can this become large?

The proposed initial paid workflow is provider-sponsored API migrations. If it is validated, the same execution-boundary and evidence system can expand to security patches, framework upgrades, compliance changes, and large codebase refactors. If software changes are increasingly generated by agents, teams will need a portable control layer that determines what code an agent may use and explains how the resulting change stayed within scope.

## Equity and legal

- Legal entity: [FOUNDER INPUT REQUIRED]
- Incorporation jurisdiction and date: [FOUNDER INPUT REQUIRED]
- Founder ownership: [FOUNDER INPUT REQUIRED]
- Employee, advisor, or investor equity: [FOUNDER INPUT REQUIRED]
- Money raised: [FOUNDER INPUT REQUIRED]
- Current fundraising: [FOUNDER INPUT REQUIRED]
- IP created while employed or using another institution's resources: [FOUNDER INPUT REQUIRED]
- Prior commitments, SAFEs, grants, or accelerators: [FOUNDER INPUT REQUIRED]

## Other ideas considered

1. The broader context compiler for any coding agent and any repository task.
2. Reviewer evidence packets for teams managing many agent-assisted pull requests.
3. A benchmark and evaluation layer for comparing agent outcomes under different context boundaries.

The API-migration workflow is first because it has a clearer buyer, distribution path, and binary outcome.

## One-minute founder video script

Use this as a structure, not a teleprompter.

> Hi, I'm Tarang, the founder of Locus. [One specific sentence establishing who you are and your strongest relevant achievement.]
>
> API companies publish breaking changes, but their customers still have to find every affected use and migrate it themselves. This creates support work for the provider and delays adoption.
>
> Today, Locus compiles a software task into an evidence-backed code boundary for an agent. I am now testing the first paid workflow: using that context compiler to turn API changes into verified migration pull requests. The migration workflow is not yet fully automated.
>
> I built and launched the first version in about seven weeks. Today I have [truthful user/revenue evidence]. Over the next six weeks I am running real migration pilots with API providers. [Why you personally will pursue this for years.]

Record in one take, look at the camera, and use plain language. Do not insert product footage into the founder video; submit the product demo separately.

## Pre-submit truth check

- Every number has a source and a time window.
- The application does not call founder activity “users.”
- The 15-case benchmark limitations are explicit.
- The application does not claim that the API-migration workflow is built or validated before it is.
- The full-time answer is unambiguous.
- The founder achievement is specific and verifiable.
- The product description is understandable in one reading.
- The demo works without sign-in and shows the core loop immediately.

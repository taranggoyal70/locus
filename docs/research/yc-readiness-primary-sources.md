# Locus YC-readiness memo

**As of:** August 30, 2026  
**Source policy:** Current first-party Y Combinator pages and this repository only.  
**Product meaning:** In Locus, “localization” means locating the code relevant to a software task. It does not mean language translation.

## Executive judgment

YC publishes a useful base rate: more than 10,000 companies apply every three months and YC typically accepts 1% ([YC, Resources for Investors](https://www.ycombinator.com/investors)).

My present estimate for Locus is **around the 1% base rate, with a plausible 0.5–2% range** if the application were submitted today. This is a judgment, not a YC statistic or a model-derived probability. The uncertainty is large because the repository does not establish the founder's strongest achievements, full-time commitment, customer conversations, active-user cohorts, revenue, or any traction that may exist off-repo.

The current product is credible evidence that the founder can build and ship. It is not yet strong evidence that Locus is a company people urgently want. The public evidence is a live early-access product, 269 commits by one author in about seven weeks, a 15-case benchmark drawn from the author's own repositories, no independent evaluation, no published customer retention, and no enabled billing ([Locus README](../../README.md)). YC explicitly funds pre-revenue and even idea-stage teams, so this is not an automatic rejection. But in an unusually crowded AI developer-tools market, an application whose main proof is engineering completeness will probably blend in.

The highest-leverage change is not another feature or a broader “AI coding agent” claim. It is to turn Locus into a narrow, measurable workflow for a specific buyer:

> **Locus is a context compiler for coding agents. It converts a task and repository into a versioned, inspectable execution boundary: every admitted file has evidence, excluded files stay unavailable, and the agent must justify widening the boundary.**

Then prove that promise with real teams: paid design partners, repeated weekly use, merged proposals, time-to-review reduction, and human correction rates. “53% estimated context reduction” is an implementation metric. “The reviewer approved the change in 12 minutes instead of 45” is a customer outcome.

## What YC says it selects for

### Sourced facts

1. **Clear, concise, matter-of-fact explanation.** YC's application guidance says readers need to understand what the company makes immediately, without marketing language. It says the first sentence should be simple and specific ([YC, How to Apply](https://www.ycombinator.com/howtoapply)).
2. **Exceptional founders, demonstrated specifically.** The same guidance calls the question about the most impressive thing each founder has built or achieved the most important question in the application. The magnitude and specificity of the achievement matter more than its type or conventional pedigree ([YC, How to Apply](https://www.ycombinator.com/howtoapply)).
3. **A non-obvious insight.** YC says it cares more about founders than the initial idea because ideas often change, but a strong idea is evidence of founder insight. Merely promising better design or execution is not an insight. Applicants should explain the distinctive approach, acknowledge obstacles, and show a theory for overcoming them ([YC, How to Apply](https://www.ycombinator.com/howtoapply)).
4. **Evidence that the team can build.** YC says the founding team should be able to build the product itself rather than outsource it ([YC FAQ](https://www.ycombinator.com/faq)).
5. **A demo and short founder video help.** YC says it checks the demo and is statistically more likely to interview teams that submit a video ([YC, How to Apply](https://www.ycombinator.com/howtoapply)).
6. **Traction is helpful, not required.** YC says about 40% of funded companies in an average batch are only an idea and most have no revenue. It recommends applying as soon as there is a founding team and an idea the founders care about ([YC FAQ](https://www.ycombinator.com/faq)).
7. **Solo founders can be accepted, but YC considers them harder.** YC regularly accepts solo founders while advising that a startup is more likely to succeed with a co-founder ([YC FAQ](https://www.ycombinator.com/faq)).
8. **Full-time commitment is required if accepted.** Founders may apply while employed or studying, but YC expects them to work full-time during and after the batch ([YC FAQ](https://www.ycombinator.com/faq)).
9. **Reapplication is normal and progress matters.** YC says roughly half of a typical batch applied more than once, and progress since an earlier application is a strong signal ([YC FAQ](https://www.ycombinator.com/faq)).
10. **YC wants early shipping and direct user contact.** Its published operating principles include staying close to users, talking to them directly, moving fast, and launching early ([YC, Software at YC](https://www.ycombinator.com/software)). Its essential startup advice says to choose one or two key metrics, focus on the most acute customer problem, and talk to customers instead of answering every problem with more features ([YC's Essential Startup Advice](https://www.ycombinator.com/blog/ycs-essential-startup-advice/)).

### Inference for Locus

Locus already shows the “can build” signal unusually well. The repository also demonstrates care around security, operational readiness, evaluation design, and honest claims. Those are positive founder-execution signals.

The weak signals are customer urgency and distinctive insight. The current description—select a task-sized subset of a repository for a coding agent and reduce context—can sound like a useful feature inside an agent, IDE, code graph, or model provider rather than a venture-scale independent company. The application needs to teach YC something non-obvious, such as:

- agent failures often start before generation, when the agent forms the wrong scope;
- normal test suites can show that changed code works without showing that the agent understood the requested boundary;
- review evidence, not token reduction, is the durable product and data asset;
- repeated task-to-scope-to-diff-to-human-decision records can improve how a team governs and evaluates every coding agent it uses.

That insight becomes convincing only when real developers repeatedly use Locus and accept its scope or review evidence.

## Category fit and competitive pressure

### Sourced facts

YC is actively funding AI developer tooling. Its current directory includes many companies around agent orchestration, code graphs, context, cost, review, verification, and sandboxing ([YC Developer Tools directory](https://www.ycombinator.com/companies/industry/Developer%20Tools)). Particularly relevant examples include:

- **Morph (S23):** builds specialized models for code search, context compaction, edits, and routing for coding agents; its official profile describes WarpGrep as a code-search subagent for Codex and Claude Code ([YC company profile](https://www.ycombinator.com/companies/morph)).
- **Greptile (W24):** indexes codebases and reviews pull requests with codebase context. Its official profile says it reviews millions of changes weekly and that customers merge pull requests four times faster on average ([YC company profile](https://www.ycombinator.com/companies/greptile)).
- **Graphify Labs (S26):** a queryable knowledge graph over code, docs, and Jira, plus verification of code changes. Its YC profile reports 105,000+ GitHub stars, about 5 million downloads, 6,000+ early signups, and enterprise production use ([YC company profile](https://www.ycombinator.com/companies/graphify-labs)).
- **Codag (S26):** compresses and governs tool-call output across agent harnesses ([YC company profile](https://www.ycombinator.com/companies/codag)).
- **Alchemize (P26):** breaks agent-produced changes into dependency-ordered reviews and surfaces prompts, intent, assumptions, and test evidence ([YC Developer Tools directory](https://www.ycombinator.com/companies/industry/Developer%20Tools)).
- **Glen (S26):** retrieves prior repository and team context for agents such as Claude Code, Codex, and Cursor ([YC company profile](https://www.ycombinator.com/companies/glen)).
- **Agentic Fabriq (W26)** and **Alter (S25)** address control-plane, least-privilege, or authorization problems for agents, making generic “agent governance” positioning crowded as well ([Agentic Fabriq](https://www.ycombinator.com/companies/agentic-fabriq), [Alter](https://www.ycombinator.com/companies/alter)).

These are company-supplied claims published in YC's official directory, not independently verified results.

YC explicitly says that having already funded a similar company does **not** reduce an applicant's chances; it expects startup ideas to evolve and is willing to fund competitors ([YC FAQ](https://www.ycombinator.com/faq)). Its Fall 2026 Requests for Startups also treats agentic coding tools as established infrastructure and asks for new applications that use agents to maintain customer code automatically ([YC Requests for Startups](https://www.ycombinator.com/rfs.html)). YC cautions that Requests for Startups are only a fraction of what it funds, not an application requirement.

### Inference for Locus

The category is fundable, but the comparison bar is high. The current public Locus evidence—15 author-owned cases and no independent usage—is much weaker than the adoption evidence displayed by several newly funded developer-tool companies. That does not mean Locus needs thousands of stars. It means the application must win through one of the following:

1. exceptional founder evidence that is not visible in this repository;
2. a sharper technical or market insight than “agents need less context”;
3. unusually strong early customer pull in a specific workflow;
4. a combination of all three.

Trying to out-pitch broad agent orchestration, code graphs, token compression, code review, or generic agent security is the wrong competition. Locus's narrower wedge is **task-specific semantic code admission**: compiling a versioned boundary for one task, withholding excluded code from the agent, and requiring evidence for every widening decision. Search tools optimize for maximum understanding; IAM tools govern credentials and APIs; Locus should prove that a deliberately bounded view improves completed-task correctness or cost while leaving an auditable context ledger.

## What the product should become

This is a proposed strategy, not a sourced YC requirement.

### Initial customer

Target engineering teams with roughly 10–100 developers that:

- use two or more coding agents regularly;
- produce enough agent-assisted pull requests that review, not code generation, is becoming the bottleneck;
- work primarily in TypeScript/JavaScript at first;
- can measure pull-request review time, rework, or escaped scope mistakes;
- have an engineering manager or platform lead who can buy a pilot.

Avoid selling first to casual individual developers. They can produce usage, but they are less likely to have acute review-governance pain or budget.

### Narrow product loop

1. Ingest a GitHub issue, acceptance criteria, and repository.
2. Compile an editable, versioned context boundary: admitted files, excluded areas, required checks, unresolved evidence, and the reason for every decision.
3. Expose that boundary through CLI/MCP inside the customer's existing Codex, Claude Code, or Cursor workflow rather than requiring a replacement agent.
4. Withhold excluded source by default and require a recorded reason when the agent widens its boundary.
5. Compare the resulting diff and checks with the compiled boundary.
6. Publish a reviewer packet on the pull request: intended scope, actual scope, widening ledger, unexplained deviations, check evidence, and remaining human decisions.
7. Record the human outcome: accepted, corrected, rejected, and why.

This uses Locus's existing code-localization and evidence foundations while creating a repeatable team workflow and a proprietary feedback dataset. It also avoids competing primarily on the underlying model.

### What to stop emphasizing

- “AI coding agent” as the entire category description.
- Estimated token savings as the headline.
- Perfect recall on a benchmark that is designed to fail unless retained cases pass.
- Broad future features such as teams, billing, private repositories, end-to-end autonomy, and every agent integration all at once.
- Production polish that is not connected to a user or revenue experiment.

### What to measure

Choose one primary metric: **weekly merged pull requests reviewed with Locus evidence**.

Supporting measures:

- weekly active teams and four-week team retention;
- percentage of generated scope contracts accepted without edits;
- percentage of Locus-reviewed pull requests merged;
- median reviewer minutes per pull request before and after Locus;
- percentage of pull requests where Locus catches an unexplained scope deviation;
- human correction or rejection rate;
- paid pilot revenue and conversion from pilot to recurring use;
- paired task-completion rate for the same task, model, and harness with normal repository access versus the Locus-compiled boundary;
- tokens, cost, and latency for those paired runs;
- false-exclusion and widening rates.

YC's public advice is to choose one or two key metrics, launch, and learn from users rather than broaden the feature set ([YC's Essential Startup Advice](https://www.ycombinator.com/blog/ycs-essential-startup-advice/)). Its product-market-fit guidance says meaningful user problems, fast launch, and listening to users are the path to early fit ([YC, The Real Product Market Fit](https://www.ycombinator.com/blog/the-real-product-market-fit/)).

## Six-week evidence plan

This plan is an inference designed to improve both the company and its YC application.

### Week 1: customer discovery, not feature discovery

- Contact 30 engineering managers, staff engineers, or platform leads who actively use coding agents.
- Conduct at least 15 conversations using recent agent-produced pull requests, not hypothetical questions.
- Ask for the last change that was slow or risky to review, how the reviewer reconstructed intent and scope, what went wrong, and what that delay cost.
- Select one repeated, expensive failure mode. If scope/review evidence is not among the top pains, change the thesis rather than forcing the current solution.

### Week 2: concierge pilot

- Recruit five design partners from the interviews.
- Manually generate and refine a scope contract and reviewer packet for real work.
- Charge something, even if the service is partially manual. Payment tests urgency better than waitlist signups.
- Support private repositories only through the narrowest secure mechanism necessary for these pilots; public-repository hobby usage is not representative of the proposed buyer.

### Weeks 3–4: workflow integration

- Implement only the GitHub plus CLI/MCP path required to repeat the pilot loop.
- Capture outcome events without capturing unnecessary source or secrets.
- Review every pilot session directly with the user.
- Publish no aggregate performance claim until the protocol and denominators are clear.

### Weeks 5–6: demonstrate pull

Targets—not YC requirements—before treating the application as materially stronger:

- 5–10 active teams;
- at least three paying teams;
- at least 25 real reviewed pull requests;
- at least three teams using Locus in two or more separate weeks;
- one sharp case study with a measured review-time or rework improvement;
- several examples where Locus identified a scope problem a normal test suite did not expose;
- the existing frozen 40-arm agent-run study completed with task success, accepted-proposal rate, cost, latency, false exclusions, and widening reported honestly.

These numbers would not prove product-market fit. They would transform the application from “well-built project in a hot market” into “founder found a specific pain and customers are pulling on the solution.”

## Application recommendation and timing

### Sourced facts

YC is currently accepting **late applications for Fall 2026**. The batch runs September through December in San Francisco. The on-time deadline was July 27 at 8 p.m. Pacific; on-time decisions were due August 28. YC still considers late applications but does not guarantee a response date. Promising applicants are invited to video interviews, generally in August and September ([YC Apply](https://www.ycombinator.com/apply)).

YC says repeat applications are normal and progress after a prior application is a strong signal ([YC FAQ](https://www.ycombinator.com/faq)).

### Recommendation

Apply late now **only if** the founder can commit full-time if accepted and can submit a crisp application and honest 60-second demo within a few days. A late application has option value, and rejection does not damage a later application. Continue customer work immediately and send material updates if the application system permits.

If full-time commitment is not possible or the application would contain no customer evidence, do not spend weeks polishing it. Use the six-week plan, then apply to the next batch with concrete progress. YC's own data makes reapplication with progress a normal path, not a failure.

## Suggested application framing

This language is an inference and should be rewritten in the founder's natural voice.

**What does the company make?**

> Locus compiles a software task and repository into an inspectable context boundary for a coding agent. Every admitted file has evidence, excluded files stay unavailable, and every widening decision is recorded for the reviewer.

**Why now?**

> Coding agents increasingly search an entire repository on their own, making their context expensive, irreproducible, and hard to audit. Teams need a task-specific boundary that is portable across agents and records exactly what code shaped a result.

**What is the non-obvious insight?**

> Search systems optimize for finding more relevant code. The missing primitive is semantic code admission: the smallest evidence-backed boundary an agent may use for a particular task, with controlled widening when the initial evidence is insufficient.

**Initial wedge:**

> TypeScript teams using multiple coding agents and reviewing agent-assisted pull requests every week.

Do not say “100% recall” without immediately explaining the 15-case, author-owned, retained-case methodology. A YC reader who discovers that limitation after seeing the headline may discount the founder's judgment. The repository's current, careful explanation is the right standard.

## Bottom line

Locus should apply to YC, but it should not confuse technical launch readiness with YC readiness.

- **Positive:** technical founder execution, live product, honest evidence boundaries, current AI developer-tool category, and a plausible urgent problem.
- **Negative:** roughly 1% overall YC base rate, solo-founder disadvantage unless offset by founder magnitude, no public independent traction or revenue, author-owned benchmark, and intense competition from recently funded agent infrastructure.
- **Best move:** sell scope assurance and review evidence to a narrow team buyer, run paid concierge pilots, measure repeated merged work, and make the application about a newly discovered customer truth—not about the number of features already built.

With a defensible paired outcome improvement and 3–10 paying teams, a **subjective 2–5% range** would be plausible—still very competitive, but materially stronger than the present case. Without that evidence, more product breadth is unlikely to change the odds materially.

# Locus market differentiation

**As of:** September 8, 2026  
**Source policy:** Current first-party product documentation and this repository only.  
**Question:** How is Locus different from AI coding agents, code intelligence and review tools, and API/SDK migration products already in the market?

## Executive answer

Locus is not differentiated merely because it uses repository context, runs code in a sandbox, executes tests, records an agent session, or produces a pull request. Cursor, GitHub Copilot, Devin, Claude Code, Amp, Sourcegraph, and Greptile already cover substantial parts of that territory.

The strongest credible distinction is the combination of three ideas:

1. **Task-specific code admission.** Locus produces an explicit Slice before and during execution. It records included and excluded paths, withholds excluded source from the agent, and requires a reason to Widen the boundary.
2. **Evidence bound to the exact proposal.** Locus is designed to preserve the Slice ledger, append-only Steps, exact check commands and results, token usage, and a human Review tied to the proposal hash. Review is deliberately separate from permission to write externally.
3. **A provider-to-consumer migration workflow.** The proposed commercial wedge is not “another coding agent.” It is helping an API or SDK company identify affected customer repositories and deliver review-ready upgrades with evidence for each repository owner.

The third point is the most valuable market distinction, but it is presently a **strategy being validated, not a shipped or proven workflow**. The current product ships public-repository localization and has a controlled Agent Run foundation; the migration campaign experience, customer-repository authorization, and external delivery loop are not yet complete ([README](../../README.md), [validation sprint](../yc/VALIDATION_SPRINT.md), [delivery ADR](../adr/0002-separate-review-from-external-delivery.md)).

The concise positioning is:

> Coding agents help a developer change a repository. Locus is being built to help an API company safely move its customer ecosystem to the next version, showing why every repository and file changed and whether each migration passed its required checks.

## What Locus actually does today

The current implementation maps a natural-language task plus optional evidence to a focused Slice of supported JavaScript, TypeScript, Python, Vue, Svelte, and Astro source. It parses internal imports, resolves several alias and monorepo patterns, anchors files that match the task, follows dependency Closures and direct consumers, and uses recent-change signals for ranking. When evidence is weak it returns the whole loaded Repo and explains unmatched terms and possible refinements rather than pretending a small Slice is safe ([README](../../README.md), [domain definitions](../../CONTEXT.md), [localizer implementation](../../src/lib/localizer.ts)).

The Agent Run layer goes beyond prompt-time retrieval:

- the agent can list included, excluded, Widened, and newly created paths;
- reads and searches are limited to the active Slice;
- an excluded file must be admitted through an explicit `widen_file` operation with a recorded reason;
- sensitive categories such as authentication, deployment configuration, database migrations, lockfiles, and agent policy cannot be Widened by the model;
- shell access is replaced with an allowlist of test, typecheck, lint, and build commands;
- token and time budgets are enforced;
- the output is a review-ready proposal, not an autonomous merge or deployment ([coding-agent implementation](../../src/lib/agent/coding-agent.ts), [workspace controls](../../src/lib/agent/workspace-tools.ts), [product direction](../product/locus-best-version.md)).

Run records include task acceptance criteria, included/excluded/Widened files, append-only Steps, Artifacts, Reviews, proposal hashes, and factual token usage. The lifecycle prevents invalid forward transitions and makes terminal Runs immutable ([Run snapshot](../../src/lib/agent/run-view.ts), [Run lifecycle](../../src/lib/agent/run-state.ts), [Run evidence ADR](../adr/0001-run-module-owns-lifecycle-and-evidence.md)).

The benchmark is useful but limited. It replays 15 historical fixes across three repositories owned by Locus's author, reports 100% fix-file recall for retained cases, 53% median estimated context reduction, and two whole-repository Widens. It is a regression suite, not independent proof that an agent completes tasks better or more cheaply ([benchmark method and cases](../../benchmarks/README.md)). A separate 40-arm paired evaluation is designed to compare total tokens only when both the Slice and whole-repository runs satisfy the same acceptance criteria, but the README says the gate remains incomplete ([README](../../README.md), [evaluation script](../../scripts/release1-eval.mjs)).

## Market map

| Category | Representative products | What they already do | Where Locus can still differ |
| --- | --- | --- | --- |
| General coding agents | Cursor, GitHub Copilot, Devin, Claude Code, Amp | Search repositories, edit multiple files, run commands and tests, work in isolated or permissioned environments, create PRs, and preserve varying levels of session history | Make the **allowed code boundary** a first-class, reviewable artifact, then apply it to a focused provider-sponsored migration workflow |
| Code intelligence and large-scale change | Sourcegraph Cody and Batch Changes | Retrieve context with search and a code graph; target many repositories; run declarative commands; preview and publish changesets; track checks, review, and merge status | Adapt migration work per repository with an agent while preserving file-admission and outcome evidence; this must outperform scripted/codemod approaches on real migrations |
| AI code review | Greptile, GitHub Copilot code review, Amp review | Analyze diffs with wider codebase context, enforce rules, produce findings and suggested fixes, and expose review summaries | Constrain and record what the generating agent could read **before and during** execution, then give the reviewer the resulting boundary and Widen history |
| Agent infrastructure | Morph | Supply fast edit application, code retrieval, and context compaction primitives with published speed and accuracy benchmarks | Own the controlled workflow and human decision record rather than compete on raw edit or retrieval speed |
| SDK generation and release | Stainless, liblab | Generate provider-owned SDKs and docs from API specs, publish releases, automate CI/CD, detect or manage breaking changes, and sometimes produce migration guides or codemods | Upgrade the **applications consuming** an SDK rather than generate the SDK itself |

## Competitor-by-competitor findings

### Cursor

Cursor Agent autonomously explores a codebase, edits multiple files, runs commands, and fixes errors. Cursor also automatically retrieves relevant code and lets users scope context manually with files, folders, symbols, and version-controlled rules ([Agent modes](https://docs.cursor.com/en/agent/modes), [working with context](https://docs.cursor.com/en/guides/working-with-context), [Agent tools](https://docs.cursor.com/en/agent/tools)). Background Agents clone repositories into isolated Ubuntu machines, auto-run commands, and work asynchronously; Cursor explicitly documents the prompt-injection and data-exfiltration risk created by an internet-connected agent that auto-runs commands ([Background Agents](https://docs.cursor.com/background-agent)).

**Real overlap:** autonomous multi-file work, repository context, rules, isolated execution, testing, review, and background operation.

**Credible Locus distinction:** Cursor documents context retrieval and manual context selection, but its public docs do not describe an immutable per-task ledger of every admitted and excluded file, a required reason for each scope expansion, or a provider-sponsored downstream migration campaign. This is a difference in product contract, not proof that Cursor could not build it.

**Do not claim:** “Cursor gives the model the whole repository,” “Cursor has no guardrails,” or “Cursor cannot show what it read.” Cursor automatically retrieves context, exposes rules and tool controls, and its background agent runs in an isolated machine.

### GitHub Copilot cloud agent

Copilot cloud agent is a strong governance comparison. GitHub documents ephemeral development environments, automated tests and linters, session logs showing reasoning and tools, token usage, signed commits, and links from commits to the originating session. Shared sessions expose prompts, responses, and file changes ([managing agent sessions](https://docs.github.com/en/copilot/how-tos/copilot-on-github/use-copilot-agents/manage-and-track-agents)). GitHub also restricts agent PRs: human review and merge are required, workflow execution is gated by default, and repository protections continue to apply ([risks and mitigations](https://docs.github.com/en/copilot/concepts/agents/cloud-agent/risks-and-mitigations)). Repository and path-specific instructions, `AGENTS.md`, skills, MCP servers, and hooks give Copilot broad customization and policy surfaces ([repository instructions](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/add-custom-instructions/add-repository-instructions), [hooks](https://docs.github.com/en/copilot/reference/hooks-reference)).

**Real overlap:** controlled cloud execution, validation, human-gated PRs, audit/session records, signed commits, repository-specific context, and tool-call policy.

**Credible Locus distinction:** Locus treats the task-to-Slice decision itself as evidence and prevents source reads outside that Slice unless an explicit Widen is accepted by policy. GitHub's published session log is broad execution provenance; Locus can specialize in **context-admission provenance** and migration-specific acceptance criteria.

**Do not claim:** “Locus is the only auditable agent,” “other agents cannot trace commits to their work,” or “GitHub lets agents merge without review.” Those claims conflict with GitHub's documentation.

### Devin

Devin's Agent mode writes code, runs commands and tests, browses the web, and completes multi-step tasks including migrations. It indexes the main branch, surfaces relevant files and code citations during planning, and can wait for user approval before execution ([first session](https://docs.devin.ai/get-started/first-run), [interactive planning](https://docs.devin.ai/work-with-devin/interactive-planning)). Knowledge and Playbooks encode recurring team context and workflows ([Knowledge](https://docs.devin.ai/product-guides/knowledge), [advanced capabilities](https://docs.devin.ai/work-with-devin/advanced-capabilities)). Devin can also run an application after creating a PR, execute a focused browser test plan, and return a video recording as evidence ([testing and recordings](https://docs.devin.ai/work-with-devin/testing-and-recordings)).

**Real overlap:** repository indexing, relevant-file selection, citations, plan approval, autonomous execution, tests, migrations, reusable workflows, and proof-oriented review artifacts.

**Credible Locus distinction:** Locus can make the set of source files the agent is allowed to read explicit, deterministic, and reviewable, then sell a cross-organization migration outcome to the provider rather than sell a general autonomous engineer to each repository owner.

**Do not claim:** “Devin cannot plan with citations,” “Devin does not test its work,” or “Devin cannot handle migrations.”

### Claude Code

Claude Code combines allow/ask/deny permissions with OS-level filesystem and network sandboxing. Managed settings can lock down tools, MCP servers, plugins, hooks, domains, and bypass modes; hooks can inspect or block lifecycle events and tool calls ([permissions](https://code.claude.com/docs/en/permissions), [sandboxing](https://code.claude.com/docs/en/sandboxing), [organization setup](https://code.claude.com/docs/en/admin-setup)). It also exposes detailed token and cost telemetry and uses subagents to isolate exploration or specialized work ([costs](https://code.claude.com/docs/en/costs), [subagents](https://code.claude.com/docs/en/sub-agents)).

**Real overlap:** sandboxing, file and command controls, network allowlists, hooks, tool restrictions, isolated subcontexts, and token telemetry.

**Credible Locus distinction:** Claude Code provides configurable general-purpose controls. Locus can provide an opinionated compiler that derives a task-specific code boundary, persists why the boundary changed, and produces a migration-oriented reviewer packet without requiring each user to design the permission policy themselves.

**Do not claim:** “Other agents cannot prevent access to sensitive files,” “Locus is the only sandboxed coding agent,” or “only Locus measures tokens.”

### Sourcegraph Cody and Batch Changes

Cody is a mature context competitor. It retrieves code with keyword search, Sourcegraph Search, and Code Graph relationships; Enterprise retrieval enforces the requesting user's read permissions and supports multi-repository context ([Cody context](https://sourcegraph.com/docs/cody/core-concepts/context), [Cody FAQ](https://sourcegraph.com/docs/cody/faq)).

Batch Changes is the closest workflow competitor. It targets many repositories and code hosts, runs commands from a declarative batch spec, previews or publishes pull requests, and tracks checks, review status, and merge progress. Sourcegraph explicitly lists dependency upgrades, security patches, and deprecated API updates as use cases ([Batch Changes](https://sourcegraph.com/docs/batch-changes)). It also supports repository permissions, rollout windows, forks, webhooks, and commit signing ([site-admin configuration](https://sourcegraph.com/docs/batch-changes/site-admin-configuration)).

**Real overlap:** dependency-aware context, multi-repository targeting, large-scale migrations, previewed PRs, permissions, rollout control, checks, reviews, and merge tracking.

**Credible Locus distinction:** a Batch Changes spec primarily describes deterministic commands applied across a chosen set of repositories. Locus can differentiate if it understands a provider release, adapts the repair to each customer's code with an agent, constrains each run to evidence-backed source, and returns comparable receipts across the campaign. This difference must be demonstrated on migrations where a codemod or scripted batch change is insufficient.

**Do not claim:** “No existing tool can update many repositories,” “no one tracks migration PRs,” or “code graphs only search and cannot support changes.”

### Amp

Amp threads persist prompts, replies, tool calls, and changed files. A thread can run in a remote Orb, be resumed across devices, be shared with teammates, and be connected back to commits using an `Amp-Thread-ID` trailer ([Amp introduction](https://ampcode.com/docs), [threads](https://ampcode.com/docs/threads)). Amp can inspect code, execute commands and tests, delegate to specialist subagents, and run an agentic review that summarizes and checks a selected diff ([tools](https://ampcode.com/docs/tools), [models and subagents](https://ampcode.com/docs/models-and-subagents), [agentic review](https://ampcode.com/news/agentic-code-review)).

**Real overlap:** durable task history, tool traces, file changes, remote workspaces, review, and commit-to-thread provenance.

**Credible Locus distinction:** Locus can expose not only what changed and which tools ran but why particular source was admitted, what stayed unavailable, and when the boundary expanded. Its commercial wedge can be a repeatable provider-to-consumer migration campaign rather than a general development environment.

**Do not claim:** “Other agent sessions disappear,” “other tools do not preserve tool calls,” or “Locus alone links changes to agent history.”

### Greptile

Greptile builds a graph of a repository and automatically reviews pull requests using codebase-wide context. It produces summaries, severity-ranked inline findings, suggested fixes, confidence scores, and diagrams; it can learn team preferences and supports self-hosting, SSO/SAML, and audit logs ([overview](https://www.greptile.com/docs/introduction), [review anatomy](https://www.greptile.com/docs/code-review/first-pr-review)). Directory-scoped configuration lets teams define inherited rules and explicit context files ([configuration](https://www.greptile.com/docs/code-review/greptile-config)).

**Real overlap:** repository graphs, broad code context, review evidence, suggested fixes, team rules, auditability, and enterprise deployment.

**Credible Locus distinction:** Greptile primarily judges a diff after it exists. Locus's opportunity is to control and explain the generating agent's source boundary before and during the change, then carry that evidence into review. Greptile could remain complementary: Locus produces a proposal and context ledger; Greptile reviews the diff.

**Do not claim:** “Review tools only read the changed lines,” “Greptile has no code graph,” or “Greptile cannot enforce repository-specific rules.”

### Morph

Morph sells infrastructure for coding agents rather than a complete migration product. Fast Apply merges an edit snippet into original code and publishes its own speed and accuracy measurements ([Fast Apply](https://docs.morphllm.com/models/apply)). Morph also positions its tools around retrieval, context compaction, and faster agent loops ([product documentation](https://docs.morphllm.com/introduction)).

**Real overlap:** code retrieval, context efficiency, and lower-cost/faster agent execution.

**Credible Locus distinction:** do not compete on model speed or generic retrieval accuracy. Locus can use such primitives while owning the admission policy, migration workflow, acceptance criteria, and cross-organization evidence record.

**Do not claim:** “Locus is the fastest code-editing model” or compare Locus's 15-case fix-file regression suite directly with Morph's model benchmarks. They measure different systems and outcomes.

### Stainless and liblab

Stainless and liblab operate mainly on the provider side of the API lifecycle. Stainless generates and releases SDKs, supports preview branches, versioning, breaking-change management, migration guides, and enterprise release controls ([SDK editions](https://www.stainless.com/docs/reference/editions/), [branches](https://www.stainless.com/docs/sdks/test/branches/), [enterprise features](https://www.stainless.com/docs/enterprise)). Stainless has also built a codemod for a customer migration, demonstrating that downstream migration tooling is adjacent to its product ([Mux case study](https://www.stainless.com/customers/mux/)). Liblab generates SDKs and documentation from OpenAPI, Swagger, and Postman specifications and keeps them synchronized through CI/CD ([liblab documentation](https://liblab.com/docs), [quickstart](https://liblab.com/docs/get-started/quickstart-generate-sdk)).

**Real overlap:** API change intake, generated code, migration guidance, validation, versioning, publishing, and automation.

**Credible Locus distinction:** Stainless and liblab primarily create and maintain the provider's SDK artifacts. Locus's proposed job begins where those products normally end: find how customer applications use the old SDK, adapt each codebase, run its own checks, and ask its owner to review the exact change.

The clean partnership-oriented line is:

> Stainless or liblab ships the new SDK. Locus upgrades the applications that consume it.

**Do not claim:** “SDK generators do nothing for migrations.” Stainless documents migration guides, breaking-change controls, and at least one customer codemod.

## What is genuinely defensible

### 1. The data model, if it accumulates real outcomes

The architecture can record a chain that most agent products treat separately:

`provider change → repository evidence → admitted Slice → Widen decisions → exact proposal → check evidence → maintainer Review → delivery/merge outcome`

That chain could become a valuable dataset for deciding which context and checks are sufficient for a class of migration. The schema and lifecycle alone are not a moat; repeated real outcomes across independent repositories could be.

### 2. Cross-organization distribution

Selling to an API provider can turn one relationship into many repository migrations. This is structurally different from acquiring individual developers one by one. The opportunity is credible because providers already invest in SDK generation, release management, migration guides, codemods, and support. It becomes defensible only if providers authorize recurring campaigns and customer maintainers accept the resulting pull requests.

### 3. Context admission rather than context retrieval

Many products retrieve useful context. Locus can define a stronger contract: code is unavailable until admitted for this task, excluded paths remain visible as names but not source, and a Widen is a recorded policy event. This can improve reviewer confidence and reduce unnecessary code exposure. The advantage is not proven until paired evaluations show equal or better accepted outcomes, cost, or reviewability.

### 4. Portable evidence, if the agent layer becomes truly interchangeable

The localization core already has CLI, MCP, REST, and generic/Claude/Cursor export surfaces ([README](../../README.md)). That supports a future vendor-neutral evidence layer. However, hosted Agent Runs currently pin one reviewed Cloudflare model and provider, so “works across every agent” would overstate the shipped product. Portability becomes defensible when the same boundary and receipt can govern multiple production agent harnesses without changing semantics.

## Claims that would overreach

| Tempting claim | Why it is unsafe | Honest replacement |
| --- | --- | --- |
| “Locus is the first safe coding agent.” | Major agents already ship sandboxes, permissions, network controls, branch restrictions, and human review. “Safe” is also an unbounded guarantee. | “Locus limits a Run to an evidence-backed code boundary and records every permitted expansion.” |
| “Other coding agents read the entire repository.” | Cursor, Cody, Devin, Copilot, Claude Code, and Amp all retrieve or manage context selectively. | “Most agents optimize retrieval for task performance; Locus makes context admission and exclusion an explicit review artifact.” |
| “Locus is the only auditable coding agent.” | Copilot has session logs and signed commits; Amp persists prompts, tool calls, and changes; Devin and Greptile produce review evidence. | “Locus specializes the audit record around which source was admitted, excluded, or Widened for one task.” |
| “Locus proves the change is correct.” | Passing checks do not prove task correctness, and the repository's own domain language rejects that claim. | “Locus records exact check evidence and asks a human to decide each acceptance criterion against the exact proposal.” |
| “Locus reduces tokens by 53% without sacrificing quality.” | The 53% figure is estimated context reduction on 15 author-owned historical cases, not total-token savings or an agent outcome comparison. | “In a 15-case internal regression suite, Locus estimated 53% median context reduction while retaining the human-changed files; independent agent-outcome validation remains incomplete.” |
| “Locus has a 100% success rate.” | The benchmark gates on fix-file recall, includes whole-repository Widens, and does not run autonomous task completion. | “The retained 15-case regression suite has 100% fix-file recall, including two conservative whole-repository Widens.” |
| “Locus already migrates every customer's repository.” | The public demo is explicitly a vision simulation; external GitHub writes remain disabled. | “Locus is validating provider-sponsored API migrations as its first commercial workflow.” |
| “No tool handles migrations across repositories.” | Sourcegraph Batch Changes explicitly does this; Devin supports migration tasks; Stainless has delivered a codemod. | “Locus aims to combine per-repository agent adaptation with explicit context and outcome evidence across a provider-sponsored campaign.” |
| “Signed receipts make Locus tamper-proof.” | The product currently binds Reviews to proposal hashes, but a defensible signed receipt needs a specified issuer, signature format, key lifecycle, verification method, and exact payload. | “Reviews are bound to the exact proposal hash; cryptographically verifiable cross-organization receipts remain a future capability.” |

## Closest competitor and the required win

The closest direct competitor is **Sourcegraph Batch Changes**, not Cursor. Cursor, Copilot, Devin, Claude Code, and Amp compete for the coding-agent interaction. Greptile competes for review. Sourcegraph already combines code intelligence with changes across many repositories and tracks the operational rollout.

Locus wins only if it proves one or more of these on real provider migrations:

1. it succeeds on heterogeneous repositories where one codemod or batch command does not;
2. maintainers accept its proposals at a higher rate because the context and check evidence are clearer;
3. providers complete migrations faster or with less support work;
4. the Slice boundary reduces total tokens or sensitive-source exposure without reducing accepted task outcomes;
5. campaign-level learning makes later repository migrations measurably better.

Without that evidence, Locus is a well-designed context and review feature that incumbents can reproduce.

## Recommended product priority

Do not try to outbuild general coding agents. Use an existing strong model or harness for generation and make Locus own the provider-to-consumer contract.

The smallest compelling workflow is:

1. ingest a provider's changelog, schema/SDK diff, migration guide, and acceptance criteria;
2. identify candidate public customer repositories using explicit evidence;
3. obtain maintainer authorization before accessing private code or delivering a change;
4. compile a per-repository Slice and show the included and excluded paths;
5. let the agent Widen only through the recorded policy path;
6. produce the exact proposal and run repository-specific checks;
7. ask the maintainer to accept or reject every migration criterion;
8. deliver only the reviewed proposal under a separate, scoped approval;
9. give the provider an aggregate campaign view without exposing customer source;
10. measure reviewed, approved, delivered, and merged migrations—not just tokens.

The first market proof should be one provider, one real breaking change, and 10–25 affected repositories. The primary metric should be **weekly merged migration pull requests**. Secondary metrics should include maintainer acceptance rate, reviewer time, provider support time, Widen rate, false exclusions, check pass rate, and total cost per merged migration ([validation sprint](../yc/VALIDATION_SPRINT.md)).

## Bottom line

Locus has a thoughtful technical distinction, but it does not yet have a proven market moat.

- **Not unique:** autonomous coding, repository search, dependency graphs, sandboxes, permissions, tests, agent logs, review summaries, or multi-repository change management.
- **Potentially distinctive:** a task-specific source-admission boundary with visible exclusions and recorded Widen decisions.
- **Potentially company-sized:** a provider-sponsored system that moves customer applications through API and SDK upgrades, with evidence and consent on both sides.
- **Still unproven:** independent task outcomes, provider demand, maintainer acceptance, cross-agent portability, completed paired token savings, and a production delivery network.

The honest message is therefore not “Locus does what nobody else can.” It is:

> Existing tools help agents find code, write changes, or review pull requests. Locus is building the missing workflow between an API release and the customer repositories that must adopt it: a controlled migration run with evidence for why each file entered scope, what changed, which checks passed, and what a maintainer approved.

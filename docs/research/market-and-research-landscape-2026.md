# Locus market and research landscape

**Accessed:** September 7, 2026
**Source policy:** This repository, official product documentation and repositories,
original papers, and official benchmark sites only. Vendor evaluation results are
vendor claims unless explicitly identified as an academic result.

## Executive judgment

Locus should **not** launch as another general-purpose coding agent or as a generic
“context engine.” Cursor, Amp, GitHub Copilot, Claude Code, and Codex already bundle
repository exploration with capable execution. Augment sells semantic Context Engine
access to other agents through MCP and an SDK. Aider has long shipped a graph-ranked,
token-budgeted repository map. Most importantly, open-source **archex** already ships
local deterministic retrieval, graph/type expansion, token-budgeted bundles, context
receipts, and integrations for several coding agents. Greptile combines a code graph,
agentic investigation, runtime validation, and review artifacts.

The credible white space is a narrower product:

> **Locus is the evidence and control layer for coding agents. It gives an agent a
> versioned, inspectable code boundary; records why every file entered that boundary;
> requires an explicit reason to widen it; verifies the frozen candidate separately;
> and reports total cost only beside a human-accepted outcome.**

This is a product hypothesis, not yet a validated company. The authoritative remote
`main` inspected for this report is commit
[`0f2e15a`](https://github.com/taranggoyal70/locus/tree/0f2e15aa8481f22ef2e1fc94c0e3d40c14011fb2),
90 commits ahead of the local checkout. It is materially stronger than the older
checkout: localization now covers JavaScript/TypeScript and Python, Vue/Svelte/Astro
script blocks, monorepo workspace names, NodeNext specifiers, and tsconfig/jsconfig
aliases. It also contains self-serve tier scaffolding and a manual npm release
workflow. It still does not establish external demand or a production advantage:

- the hosted importer is limited to public repositories and 200 source files;
- the source CLI/MCP has a guarded
  [npm release workflow](https://github.com/taranggoyal70/locus/blob/0f2e15aa8481f22ef2e1fc94c0e3d40c14011fb2/.github/workflows/release-cli.yml),
  but `locus-context` still returns 404 from the
  [npm registry](https://registry.npmjs.org/locus-context);
- shared execution is capped at one admitted Run per UTC day across the product;
- the shipped capability-release record enables only `runStart`; GitHub connection,
  private-repository read, teams, delivery, and billing remain disabled
  ([source](https://github.com/taranggoyal70/locus/blob/0f2e15aa8481f22ef2e1fc94c0e3d40c14011fb2/src/lib/admission.ts));
- the historical localization suite contains 15 author-owned cases, including two
  whole-Repo Widens that receive full recall by definition; and
- the paired outcome study has **0 of 40 results**. It is frozen to
  `gemini-3.5-flash`, while current production configuration requires Cloudflare
  `@cf/qwen/qwen3.8-27b`, so it cannot validate the current production route without a
  new, separately versioned study.

These facts come directly from the
[remote-main README](https://github.com/taranggoyal70/locus/blob/0f2e15aa8481f22ef2e1fc94c0e3d40c14011fb2/README.md), the
[historical benchmark](../../benchmarks/README.md), the
[Release 1 public report](../../benchmarks/release1/public-report.json), and the
[free-beta rollout contract](../operations/free-public-beta-rollout.md).

### Immediate public-launch blockers

As checked on September 7, 2026, the live
[`/api/health`](https://locus-five-iota.vercel.app/api/health) returned HTTP 503 with
`missing: ["database", "agent_provider"]` and `admission: "invite_only"`. Therefore
self-serve tiers exist in code but are not an operating public service.

Remote `main` also contains unresolved Git conflict markers in four committed files:
[`.env.example`](https://github.com/taranggoyal70/locus/blob/0f2e15aa8481f22ef2e1fc94c0e3d40c14011fb2/.env.example),
[`README.md`](https://github.com/taranggoyal70/locus/blob/0f2e15aa8481f22ef2e1fc94c0e3d40c14011fb2/README.md),
[`incident-response.md`](https://github.com/taranggoyal70/locus/blob/0f2e15aa8481f22ef2e1fc94c0e3d40c14011fb2/docs/operations/incident-response.md),
and
[`public-early-access-rollout.md`](https://github.com/taranggoyal70/locus/blob/0f2e15aa8481f22ef2e1fc94c0e3d40c14011fb2/docs/operations/public-early-access-rollout.md).
These are stop-ship failures: configuration and incident instructions are ambiguous,
the public README renders repository-internal merge state, and any claim that `main`
is release-ready would be false. Resolve the markers, restore a healthy production
database/provider configuration, run the frozen canary, and verify a 200 health
response before opening self-serve admission.

**Decision:** keep the localizer and evidence architecture, stop broadening the
standalone agent, and spend the next product cycle proving a vendor-neutral
**context-boundary and evaluation layer** with real engineering teams.

## What Locus actually has

The product is more defensible when described by its implemented constraints rather
than by broad AI claims.

| Implemented primitive | Repository evidence | Strategic value |
| --- | --- | --- |
| Deterministic source graph | Remote `main` resolves JavaScript/TypeScript imports (including aliases, NodeNext, and workspace packages), Python imports, and script-block imports in Vue/Svelte/Astro ([localizer](https://github.com/taranggoyal70/locus/blob/0f2e15aa8481f22ef2e1fc94c0e3d40c14011fb2/src/lib/localizer.ts)). | Reproducible candidate generation and a traceable reason for inclusion. |
| Task-to-Slice localization | Task terms select Anchors; their dependency Closures, direct consumers, and Recent files form the Slice ([domain language](../../CONTEXT.md)). | A reviewable starting boundary instead of an opaque retrieval result. |
| Conservative uncertainty behavior | Weak evidence causes a whole-Repo Widen with unmatched terms and refinement guidance ([localizer](../../src/lib/localizer.ts)). | Avoids silently treating a narrow, uncertain result as complete. |
| Enforced workspace boundary | Agent tools expose included paths and withhold excluded source; sensitive paths cannot be casually widened ([coding agent](../../src/lib/agent/coding-agent.ts)). | Potential control-plane wedge if the same property can be enforced across third-party agents. |
| Candidate-bound verification | A frozen candidate is materialized into a fresh, network-denied sandbox, byte hashes are checked, and approved commands run there ([verification](../../src/lib/agent/verification.ts)). | Stronger correspondence between the reviewed bytes and the recorded Check evidence. |
| Review distinct from delivery | Human Review is bound to a proposal hash; external delivery is a separate capability ([ADR-0002](../adr/0002-separate-review-from-external-delivery.md)). | Useful governance primitive for teams operating several coding agents. |
| Outcome-aware accounting | Active and failed Runs can show factual usage, but Savings claims require a successful outcome ([ADR-0001](../adr/0001-run-module-owns-lifecycle-and-evidence.md)). | A better economic metric than initial prompt size alone. |

The weakness is breadth and proof. Even on remote `main`, the Graph omits call,
inheritance, symbol, config, schema, and many framework/runtime relationships.
Full-file packing is coarse. The current public evidence measures whether future fix
files were included, not whether an agent solved a fresh task at equal quality with
lower total cost.

## Competitive map

Prices below are the vendors' public USD list prices on the access date. Usage limits,
tax, annual discounts, and enterprise contracts can change.

| Product | Officially documented overlap | Public price | Implication for Locus |
| --- | --- | --- | --- |
| **Cursor** | Agent autonomously searches and reads the codebase, edits files, runs commands, and fixes errors. Cursor also automatically supplies estimated-relevant code and lets users add files, folders, symbols, git history, and rules ([context](https://docs.cursor.com/en/guides/working-with-context), [tools](https://docs.cursor.com/en/agent/tools)). | Hobby free; Pro $20/mo, Pro+ $60/mo, Ultra $200/mo; Teams Standard $40/user/mo and Premium $120/user/mo; Enterprise custom ([pricing](https://prod.cursor.com/help/account-and-billing/pricing)). | “Find relevant code for an agent” is bundled. Locus must add enforceability and evidence that Cursor does not publicly describe. |
| **Amp** | Multi-model agent, persistent Threads, cloud Orbs, GitHub delivery, shared team context, code/search tools, a remote-repository Librarian, and agent-to-agent work ([overview](https://ampcode.com/docs), [tools](https://ampcode.com/docs/tools), [threads](https://ampcode.com/docs/threads)). | Megawatt $20/mo; Gigawatt $200/mo; pay-as-used model/tool billing; Enterprise usage is 50% higher and starts with a $1,000 purchase ([pricing](https://ampcode.com/docs/pricing)). | Amp competes on execution and context continuity. Locus should integrate with it rather than reproduce it. |
| **Augment Code** | Context Engine performs semantic, relationship-aware, cross-repository retrieval and is sold through MCP and TypeScript/Python SDKs for use by other agents ([Context Services](https://docs.augmentcode.com/context-services/overview)). Augment also sells agents, code review, automations, and cloud compute. | Standard $20/mo flat and Business $100/mo flat, each for up to 50 seats with an equal amount of included usage; Enterprise custom. LLM usage carries a 40% service fee ([pricing](https://www.augmentcode.com/pricing)). | This is the closest commercial collision. Locus cannot win on “universal context for fewer tokens” alone. |
| **archex** | Open-source, local-first retrieval using BM25F, optional vector/SPLADE signals, graph/type expansion, intent-routed token budgets, and receipts for freshness, omissions, and completeness. It offers CLI, MCP, Python, Docker, and client setup for Claude Code, Codex, Cursor, OpenCode, Pi, and oh-my-pi. Its hooks are explicitly non-blocking; for Codex and Cursor they are diagnostics-only rather than interceptors ([official repository](https://github.com/Mathews-Tom/archex)). | Apache-2.0 software; local inference is optional and no hosted subscription is documented. | This is Locus's closest open-source technical comparison. Archex is broader and more mature in retrieval, languages, packaging, and context receipts. Locus should not compete on those claims; its viable wedge is an **enforced** read/change boundary plus candidate-hash verification, human Review, and accepted-outcome accounting. |
| **GitHub Copilot** | IDE/CLI agents, a cloud agent that researches, plans, edits a branch and opens a PR, code review with full-project context, MCP, repository memory, third-party Claude/Codex agents, and cloud/local sandboxes ([cloud agent](https://docs.github.com/en/copilot/concepts/agents/cloud-agent), [code review](https://docs.github.com/en/copilot/concepts/agents/code-review), [sandboxes](https://docs.github.com/en/copilot/concepts/about-cloud-and-local-sandboxes)). | Individual: Free, Pro $10/mo, Pro+ $39/mo, Max $100/mo. Organization: Business $19/seat/mo and Enterprise $39/seat/mo; agent usage consumes AI credits and some flows consume Actions minutes ([plans](https://docs.github.com/en/copilot/get-started/plans)). | GitHub owns repository distribution and can bundle execution, review, and policy. Locus needs cross-vendor evidence GitHub has no incentive to provide. |
| **Claude Code** | Local terminal/IDE agent with file and shell tools, permissions, MCP, hooks, subagents, cloud/web/Slack surfaces, and session continuation. Anthropic says it works without a remote code index ([CLI](https://docs.anthropic.com/en/docs/claude-code/cli-usage), [enterprise product](https://claude.com/product/claude-code/enterprise)). | Pro $20/mo; Max 5x $100/mo; Max 20x $200/mo; Team $100/person/mo with two-member minimum; Enterprise custom ([individual pricing](https://claude.com/product/claude-code), [team pricing](https://claude.com/product/claude-code/enterprise)). API use is token billed. | Locus can be a local admission-control and evidence adapter for Claude Code; a plain MCP search tool cannot enforce a boundary when shell/file tools remain unrestricted. |
| **OpenAI Codex** | Local and cloud agents, isolated worktrees/containers, parallel tasks, tests and terminal evidence, PR review, skills, automations, and GitHub delivery ([Codex app](https://openai.com/index/introducing-the-codex-app/), [cloud-agent system description](https://openai.com/index/o3-o4-mini-codex-system-card-addendum/)). | Included in ChatGPT Free and paid plans; Plus is $20/mo and Pro tiers are $100/mo and $200/mo, with task limits varying by model and task ([Codex pricing](https://chatgpt.com/codex/pricing/), [Plus](https://help.openai.com/en/articles/6950777-what-is-chatgpt-plus), [Pro](https://help.openai.com/en/articles/9793128-what-is-chatgpt-pro.)). | Codex already exposes sandbox and review evidence. Locus must prove a portable policy/evaluation layer, not claim generic “safe execution.” |
| **Sourcegraph** | Multi-repository exact/regex/symbol/diff search, precise code navigation, search contexts, natural-language query assist, Deep Search, Cody, and large-scale batch changes ([Code Search](https://sourcegraph.com/docs/code-search), [Deep Search](https://sourcegraph.com/docs/deep-search)). | Current canonical documentation describes Enterprise Starter and Enterprise but does not publish a price; a 30-day team trial is advertised. Versioned 6.6 docs listed $19/user/mo Starter and $59/user/mo Enterprise, so those figures should not be treated as a current quote ([current plan](https://sourcegraph.com/docs/pricing/plans/enterprise-starter), [v6.6 plan](https://6.6.sourcegraph.com/pricing/plans/enterprise)). | Cross-repository navigation is mature infrastructure. Locus should not compete as enterprise code search. |
| **Greptile** | Full-codebase graph review, recursive search, learned rules, multi-repository context, and TREX runtime validation with logs/screenshots/traces attached to findings ([graph context](https://www.greptile.com/docs/how-greptile-works/graph-based-codebase-context), [TREX](https://www.greptile.com/blog/trex)). | Starter free for one developer and 50 credits/mo; Pro $30/seat/mo with 50 credits, then $1/credit; standard review costs 1 credit and TREX review 3; Enterprise custom ([pricing](https://www.greptile.com/pricing)). | “Code graph + executable review artifacts” is not unique. Locus's candidate hash, exclusion ledger, and pre-execution boundary are the possible distinction. |
| **Aider** | Open-source terminal pair programmer with testing, git commits, broad model support, and a concise repository map. Its map uses dependency-graph ranking to select symbols within a dynamic token budget ([repository-map docs](https://github.com/Aider-AI/aider/blob/main/aider/website/docs/repomap.md), [README](https://github.com/Aider-AI/aider/blob/main/README.md)). | Apache-2.0 software; users pay their chosen model/provider rather than an Aider subscription. | Graph-ranked, token-bounded repository context is established prior art and available free. |
| **Continue** | The final release still provides an open-source CLI/IDE agent, model/rule/tool configuration, and file/search/git context tools ([README](https://github.com/continuedev/continue/blob/main/README.md), [CLI](https://github.com/continuedev/continue/blob/main/docs/guides/cli.mdx)). | Free, Apache-2.0 code; provider inference is separate. | Continue was acquired by Cursor and its official repository is now read-only. It is prior art and an integration lesson, not a growing independent vendor. |

### Market conclusion

The market validates three budgets: agent execution, context retrieval, and review.
It does **not** validate Locus specifically. Incumbents already bundle two or all three,
and several charge less than the cost of acquiring a small-team customer.

The under-served question is not “can an agent find code?” It is:

> Can an engineering team prove, across whichever agent it uses, what code the agent
> was allowed to see and change, why that boundary changed, whether the exact candidate
> passed checks, what a human accepted, and what the accepted result cost?

No reviewed public competitor page documents that complete chain. That is an absence
in the reviewed documentation, **not proof** that competitors lack internal or
unpublished equivalents.

### Locus versus archex: the decisive comparison

Archex eliminates most of the easy differentiation. Its official repository describes
ranked syntax-aligned chunks, multi-signal retrieval, dependency/type expansion,
token budgets, freshness and completeness receipts, blast-radius analysis, local
metrics, reproducible retrieval benchmarks, and client integrations. Locus today has
a narrower static import graph despite its added Python and component-file support,
coarser full-file packing, and far less public evaluation evidence.

The remaining distinction must be operational, not rhetorical:

| Control | archex public contract | Locus direction |
| --- | --- | --- |
| Context selection | Rich local bundle and receipt; hooks augment or diagnose but do not block reads. | Keep transparent localization, but expose only admitted source in an isolated workspace. |
| Scope change | Receipt reports skipped/omitted context and next action. | Make every Widen a policy event with evidence, reason, decision, and immutable history. |
| Change verification | Retrieval/release evidence and benchmark artifacts. | Bind checks to the frozen candidate bytes and record the candidate hash. |
| Human outcome | Not positioned as a candidate-bound Review system. | Bind accept/reject Review to that hash and report total usage only beside accepted outcome. |

This comparison makes the strategy falsifiable. If Locus ships only an MCP retriever
with better ranking or a similar receipt, archex makes it a weak duplicate. If Locus
can enforce the admitted filesystem view across agents and preserve an auditable chain
from boundary through Widen, exact candidate, checks, Review, and cost, it occupies a
narrower governance category. The report found no public archex claim of such
end-to-end enforcement, but that absence is not proof of permanent exclusivity.

## What the research says

### Retrieval is necessary, but no single retrieval signal is enough

- **RepoCoder** combined similarity retrieval and generation iteratively and improved
  repository-level completion over an in-file baseline by more than 10% across its
  settings ([EMNLP 2023 paper](https://aclanthology.org/2023.emnlp-main.151/)). This
  supports iterative evidence gathering rather than a one-shot Slice.
- **CodeRAG** identifies query construction, single-path retrieval, and retriever/model
  misalignment as failure modes; it combines model-guided queries, multi-path
  retrieval, and preference-aligned reranking
  ([EMNLP 2025 paper](https://aclanthology.org/2025.emnlp-main.1187/)).
- **AIRCoder** combines eight signals spanning textual similarity, dependency
  existence, and structural hierarchy. It reports a 4.63% average exact-match gain
  over its best baseline and 10.2x higher efficiency on completion benchmarks across
  Python, Java, C#, and TypeScript
  ([ACL 2026 paper](https://aclanthology.org/2026.acl-long.1166/)).
- **Retrieval-Oriented Code Representations in Agentic Bug Localization** treats the
  representation itself as a design variable. Across Long Code Arena and SWE-bench
  Verified, its role-aware summaries beat file-path representations by up to 40%
  Hit@5 while using a 10.4–20.9x smaller representation footprint than raw source;
  combining representations and LLM reranking produced further gains
  ([2026 paper](https://arxiv.org/abs/2607.11046)).

**Implication:** Locus's keyword/path scoring plus import graph is a useful transparent
baseline, not a state-of-the-art retrieval system. Add symbol, call, inheritance,
configuration/schema, history, and semantic signals. Preserve explainability by
recording which signal admitted each item and by keeping deterministic candidate
generation separate from any learned reranker. Test concise role-aware symbol/module
summaries as another retrieval representation, but record their model/version and do
not treat generated summaries as authoritative code evidence.

### Upstream retrieval now has purpose-built benchmarks

- **ContextBench** contains 1,136 issue-resolution tasks from 66 repositories across
  eight languages with human-annotated gold context. It evaluates agent trajectories
  at recall, precision, and efficiency; the authors report that agents generally favor
  recall over precision, sophisticated scaffolding adds only marginal retrieval gains,
  and explored context differs substantially from context actually used
  ([2026 paper](https://arxiv.org/abs/2602.05892),
  [official repository](https://github.com/EuniAI/ContextBench)).
- **Agent Retrieval Bench** isolates the next-file problem using 427 samples across 25
  repositories: code-to-test, review-comment-to-context, trace-to-code,
  edit-to-ripple, and no-gold abstention. No retrieval family wins every task; RepoMap
  has the best reported budgeted context yield at 8K tokens, while logged agent
  trajectories miss every gold file on 27–35% of samples
  ([2026 paper](https://arxiv.org/abs/2607.24882),
  [official benchmark site](https://agent-retrieval-bench.github.io/)).

**Implication:** Release 2 should include a reproducible upstream lane on these public
tasks, alongside fresh partner outcome tests. Report file/span recall, precision,
budgeted yield, abstention, Widen rate, and provider-measured tokens. A gold-context
score diagnoses localization; it does not prove that the agent produced an acceptable
patch. Conversely, an accepted patch alone can hide wasteful or unsafe exploration.
Both layers are needed.

### Code graphs help multi-hop localization

- **RepoGraph** presents a repository graph as a plug-in navigation layer for software
  engineering agents, including integrations with Agentless and SWE-agent
  ([ICLR 2025 paper and code](https://github.com/ozyyshr/RepoGraph)).
- **LocAgent** uses a heterogeneous graph of files, classes, functions, imports,
  invocations, and inheritance. It reports up to 92.7% file-level localization,
  approximately 86% lower cost for its fine-tuned model comparison, and a 12%
  downstream Pass@10 improvement
  ([ACL 2025 paper](https://aclanthology.org/2025.acl-long.426.pdf)).
- **Multi-CoLoR** adds similar historical issue context before graph traversal and
  reports better Acc@5 with fewer tool calls on a multi-language enterprise codebase
  ([2026 paper](https://arxiv.org/abs/2602.19407)).

**Implication:** deepen the Graph before claiming large-Repo or cross-language quality.
The most defensible data is likely not the graph itself but the accumulated connection
between task evidence, admitted entities, Widen decisions, actual changes, checks, and
human decisions.

### More context can reduce quality as well as increase cost

The **Lost in the Middle** experiments found that model performance changed with the
position of relevant information and could degrade when useful evidence appeared in
the middle of a long context. Adding retrieved documents produced diminishing returns
before retrieval recall saturated
([TACL paper](https://direct.mit.edu/tacl/article/doi/10.1162/tacl_a_00638/119630/Lost-in-the-Middle-How-Language-Models-Use-Long)).

**RepoDistill** argues that both similarity and graph retrieval can still return too
much redundant context. Its learned compression/budget system reports up to 66% fewer
input tokens while maintaining comparable performance with closed models on its
benchmarks ([Findings of ACL 2026](https://aclanthology.org/2026.findings-acl.217/)).

**Implication:** the product should eventually allocate budget at symbol/chunk level,
not only file level. A larger context window does not eliminate the need for selection.
However, context compression metrics are not software-task success metrics; Locus must
measure the entire Run through accepted outcome.

### Harness and interface design materially affect results

**SWE-agent** showed that an agent-computer interface designed for repository
navigation, editing, and execution can materially improve task performance without
changing model weights ([NeurIPS 2024 paper](https://proceedings.nips.cc/paper_files/paper/2024/hash/5a7c947568c1b1328ccc5230172e1e7c-Abstract-Conference.html)).
**Agentless** then showed that a simple localization → repair → validation pipeline
could reach 32% on the historical SWE-bench Lite setting at a reported average cost of
$0.70, outperforming more elaborate open-source agents at the time
([FSE 2025 paper](https://lingming.cs.illinois.edu/publications/fse2025.pdf)).

**Implication:** Locus should not assume more autonomous steps make the product better.
Its strongest architecture is the constrained sequence and inspectable evidence, not
the number of tools or agents.

### Benchmark numbers are unusually easy to overstate

The original **SWE-bench** contains 2,294 GitHub issue/patch tasks across 12 Python
repositories and requires multi-file repository reasoning
([ICLR 2024 paper](https://arxiv.org/abs/2310.06770)). SWE-bench Verified later
human-filtered 500 tasks, but OpenAI stopped recommending it in February 2026 after
finding test/specification defects and evidence of training contamination; OpenAI now
recommends SWE-bench Pro for frontier reporting
([OpenAI audit](https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/)).
The official leaderboard also warns that results from different mini-SWE-agent releases
are not necessarily comparable
([SWE-bench Verified](https://www.swebench.com/verified.html)).

**SWE-bench-Live** was designed to reduce contamination with continuously refreshable
post-2024 tasks; its initial release contains 1,319 tasks from 93 repositories and
reproducible Docker environments
([paper](https://arxiv.org/abs/2505.23419)).

**Implication:** use fresh, held-out partner tasks and immutable snapshots. Report
model, harness, tool policy, retries, cost, acceptance rubric, and failures. Never
compare a Locus number with a leaderboard number unless the exact task set and harness
are the same.

## Defensible product thesis

### 1. Be a boundary, not another search box

Package Localize as a pre-execution contract:

1. bind the Agent Task to a repository revision;
2. emit an inspectable Slice and exclusion ledger;
3. expose only admitted source to the agent;
4. require evidence and a recorded reason for each Widen;
5. freeze the candidate bytes;
6. verify those exact bytes in a fresh restricted environment;
7. bind human Review to the candidate hash; and
8. report total tokens/cost per accepted task.

MCP alone can deliver context but cannot guarantee confinement if the host agent also
has unrestricted filesystem or shell tools. A truthful cross-agent product therefore
needs either a harness adapter that disables competing reads or an isolated filesystem
view that physically exposes only the Slice. Call a plain MCP integration “context
guidance,” not “enforcement.”

### 2. Sell to agent-platform owners, not first-time nontechnical builders

The initial buyer should be an engineering-platform, developer-productivity, security,
or AI-infrastructure lead at a team already using two or more coding agents. Their
problem is rising review load, unclear agent scope, and model spend—not access to code
generation. A nontechnical demo can explain the product, but the first paid workflow
should be governed engineering work.

### 3. Make accepted boundary data the moat

With explicit consent and strong tenant isolation, record only the minimum structured
signals needed to improve the system:

- task/evidence features and immutable base revision;
- proposed versus accepted Anchors and Slice members;
- Widen requests, reasons, and reviewer decisions;
- files actually changed and checks executed;
- accepted/rejected outcome and reviewer corrections; and
- provider-reported total input, cached input, and output usage.

The defensible asset is the mapping from task → boundary → action → evidence → human
decision, not a generic embedding index. Do not train across customers or advertise a
learning moat until data rights, volume, and measured improvement exist.

### 4. Use open distribution and paid governance

- Publish the local CLI/MCP as a one-command package and keep transparent localization
  open source.
- Provide adapters for Claude Code, Codex, Cursor, Amp, and GitHub Copilot rather than
  asking teams to replace them.
- Charge for hosted policy, evidence retention, team controls, cross-agent analytics,
  private-repository operation, and paired evaluations.
- Treat price as a test. Incumbent individual tools cluster around $10–$30/month while
  enterprise governance is custom-priced; Locus does not yet have evidence for a price
  or willingness to pay.

## Recommended 30/60/90-day program

### By day 30: validate the problem and freeze the contract

- First clear the stop-ship state: remove all committed conflict markers, restore the
  production database and agent-provider configuration, require `/api/health` 200 in
  release monitoring, pass the frozen canary, and keep self-serve closed until those
  checks hold.
- Interview 15 engineering-platform or security leads who already operate coding
  agents. Ask for a recent agent-created PR, its review thread, and available usage
  records—not opinions about a demo.
- Secure three design partners willing to supply fresh JavaScript/TypeScript or Python
  tasks and blind-review paired outputs.
- Create a new Release 2 evaluation contract tied to the exact production provider,
  model, prompt, tools, limits, and data policy. Preserve Release 1 as frozen history.
- Publish the boundary/evidence schema before optimizing retrieval: base revision,
  included and excluded paths, per-item reasons, Widen events, candidate hash, checks,
  Review decision, and factual usage.

### By day 60: make enforcement installable

- Publish the CLI/MCP package with stable JSON output and an evidence schema.
- Exercise the manual provenance-bearing npm workflow and verify the intended package
  is publicly installable; a workflow file is release machinery, not a release.
- Add an external-agent adapter that can **actually enforce** the Slice in an isolated
  workspace; label non-enforcing MCP use accurately.
- Add symbol/call/import relationships and chunk-level budgets for TypeScript before
  expanding language count.
- Export a human-readable and machine-verifiable boundary report: revision, admitted
  and excluded paths, per-item reasons, Widens, candidate hash, checks, Review, and
  factual token usage.
- Demonstrate one integration in which direct reads outside the Slice are technically
  blocked, not merely discouraged by a prompt or MCP recommendation.

### By day 90: prove outcome economics and willingness to pay

- Compare the same agent/model/harness with Locus enforcement on versus whole-Repo
  access on immutable partner snapshots.
- Blind reviewers to the arm and apply the same acceptance criteria.
- Primary metric: **total model cost/tokens per human-accepted task**.
- Safety/quality metrics: acceptance-rate gap, critical regressions, unauthorized
  access attempts, Widen rate, reviewer correction rate, and time to accepted review.
- Publish all aggregate failures and confidence intervals, not only the median win.
- Run a fixed public retrieval lane from ContextBench and Agent Retrieval Bench under
  the same 8K-token budget, publishing recall, precision, budgeted yield, abstention,
  latency, and every task-level failure.
- Ask the three partners to pay for continued evidence retention, policy management,
  and evaluation—not for “AI context.”
- Add one second language only if partner tasks demand it; research suggests Python is
  the most practical benchmark bridge, while Go may be more useful for infrastructure
  buyers.
- Continue only if repeated use and accepted outcomes survive when the founder is not
  manually operating the Runs.

### Go/no-go evidence

Advance from design-partner product to public beta only when all are true:

- remote `main` has zero conflict markers, CI/canary pass, and production health is
  continuously 200 with database and provider ready;
- the documented CLI package installs from npm and reproduces the versioned output
  contract;
- at least three external teams complete repeated tasks;
- at least 20 fresh paired tasks have complete immutable evidence;
- human acceptance is non-inferior within the predeclared five-point margin;
- median total-token reduction is at least the predeclared 30% and does not come from
  hiding failed or widened Runs;
- no critical correctness, security, or data-loss regression appears; and
- at least two teams pay or sign a time-bound paid pilot.

These are proposed decision thresholds, not current results.

## What Locus must not claim

1. **“The first context engine,” “unique code graph,” or “unique token-efficient
   retrieval.”** Augment, Aider, Sourcegraph, Greptile, Cursor, and the cited papers are
   direct prior art.
2. **“100% recall” without the boundary.** The current 100% figure is only for the 15
   retained author-owned cases, and two cases Widen to the whole Repo.
3. **“53% token savings.”** The current 53% is median estimated admitted-context
   reduction, not provider-reported total Run savings or cost per accepted task.
4. **“Verified task completion.”** Passing commands is Check evidence; human Review
   decides whether acceptance criteria were met.
5. **“Safe” or “least privilege” for a normal MCP connection.** Retrieval guidance does
   not constrain an agent that retains direct file or shell access.
6. **“Production-ready autonomous coding agent.”** The live health endpoint is 503,
   remote `main` contains committed conflict markers, the CLI is unpublished, shared
   capacity is one Run/day, all released product capabilities except `runStart` are
   disabled, and the current outcome study has no results.
7. **A SWE-bench score without an official, reproducible run.** Do not mix model-only,
   agent, Pass@1, Pass@k, Verified, Live, Pro, or different harness-release results.
8. **Independent validation of vendor numbers.** Augment and Greptile benchmarks and
   adoption figures are first-party evidence, not independent comparisons.
9. **Academic novelty, patentability, or a data moat.** Those require a broader prior-art
   review, legal analysis, lawful data rights, and evidence that accumulated data
   improves outcomes.
10. **“No competitor does this.”** The most defensible wording is: “No reviewed public
    documentation describes the complete boundary-to-human-decision chain.”

## Bottom line

Locus has a coherent technical kernel, but its original category has been absorbed by
larger agents and dedicated context products. Archex in particular makes generic
local retrieval, code graphs, token budgets, receipts, and multi-agent packaging a
poor standalone wedge. The company-sized opportunity is to make agent work
**enforceably bounded, reviewable, and economically measurable across vendors**.

The next build should therefore be an installable, enforceable adapter plus a fresh
paired study—not a more elaborate general coding agent. If three external teams will
not repeatedly use and pay for that evidence layer, the honest conclusion is that
Locus is a useful open-source feature rather than a standalone startup.

# Locus startup readiness and feature wedge

**Accessed:** September 7, 2026  
**Repository snapshot:** [`ab3c8c8`](https://github.com/taranggoyal70/locus/tree/ab3c8c89f49de8fcdc4e4de72fbfdde55d8ae4d9)  
**Source policy:** Locus source and operating records, official vendor documentation,
official repositories, and original papers or benchmark sites only. Prices are public
list prices on the access date. Vendor performance claims are not independent evidence.

## Hard verdict

**Locus is not ready for a broad public launch as a self-serve coding agent.** It is
ready to keep operating its public-repository localizer as an early-access product and
to run a tightly controlled design-partner alpha.

Technical readiness and startup readiness are different:

| Question | Verdict | Evidence |
| --- | --- | --- |
| Can a stranger try the public localizer? | **Yes, as early access.** | The product maps a task to a JavaScript/TypeScript/Python Slice and documents the hosted importer's narrower public JS/TS, 200-file limit ([README](https://github.com/taranggoyal70/locus/blob/ab3c8c89f49de8fcdc4e4de72fbfdde55d8ae4d9/README.md)). |
| Is production infrastructure configured? | **Yes, at the health-contract level.** | On the access date, the live [`/api/health`](https://locus-five-iota.vercel.app/api/health) returned HTTP 200, revision `ab3c8c8`, no missing dependency, external health checking, and `admission: "invite_only"`. |
| Can public users safely run the complete coding agent? | **No.** | Locus's own launch record says to hold Agent Run admission closed. Mobile/authenticated-path testing, accessibility, performance, alert delivery, frozen signed-in canaries, partner soak, rollback rehearsal, branch/deployment protection, billing-disabled behavior, and final capability audit remain open ([launch record](https://github.com/taranggoyal70/locus/blob/ab3c8c89f49de8fcdc4e4de72fbfdde55d8ae4d9/docs/operations/launch-readiness-2026-09-07.md)). |
| Is the product self-serve and distributable? | **Not yet.** | `runStart` is the only enabled release capability; GitHub connect, private reads, teams, delivery, and billing remain off ([admission source](https://github.com/taranggoyal70/locus/blob/ab3c8c89f49de8fcdc4e4de72fbfdde55d8ae4d9/src/lib/admission.ts)). The source CLI/MCP exists, but `locus-context` still returns 404 from the [npm registry](https://registry.npmjs.org/locus-context). |
| Is there evidence of product-market fit or a durable advantage? | **No.** | The historical suite has 15 author-owned cases and includes whole-Repo fallback. It measures changed-file inclusion, not completed tasks. The frozen paired study has **0/40** results ([public report](https://github.com/taranggoyal70/locus/blob/ab3c8c89f49de8fcdc4e4de72fbfdde55d8ae4d9/benchmarks/release1/public-report.json)). There is no retained evidence here of repeated external use, paid demand, or better accepted outcomes. |

The launch decision should therefore be:

> **Keep localization public, keep autonomous Runs invite-only, and use the next 30
> days to validate one differentiated control product with three design partners.**

## Market reality

The general coding-agent category is already occupied by products with strong
execution, repository context, review, sandboxes, and distribution.

| Product | Current official capability and price | Consequence for Locus |
| --- | --- | --- |
| **Devin / Cognition** | Devin plans, writes, runs, and tests code in a VM with a shell, IDE, browser, integrations, knowledge, parallel agents, PR review, and automations ([product intro](https://docs.devin.ai/get-started/devin-intro), [advanced capabilities](https://docs.devin.ai/work-with-devin/advanced-capabilities)). Free is $0, Pro $20/mo, Max $200/mo; Enterprise is custom ([pricing](https://devin.ai/pricing)). Security Profiles constrain network, MCP, git, and tokens across inherited session/automation scopes; Devin CLI also has path/tool/command rules and an OS sandbox ([profiles](https://docs.devin.ai/product-guides/security-profiles), [CLI permissions](https://docs.devin.ai/cli/reference/permissions), [CLI sandbox](https://docs.devin.ai/cli/sandbox)). | Locus cannot differentiate on autonomy, a VM, generic permissions, or audit logs. Devin's public cloud profile is not a task-derived semantic file boundary, while its cross-agent MCP controls Devin sessions rather than governing other agents' own tools ([Devin MCP](https://docs.devin.ai/work-with-devin/devin-mcp)). |
| **Cursor** | Agent searches and edits repositories, runs commands, fixes errors, operates locally or in cloud agents, and includes review/security products, hooks, MCP, rules, and integrations ([docs](https://cursor.com/docs)). Hobby is free; Pro $20/mo, Pro+ $60/mo, Ultra $200/mo; Teams starts at $40/user/mo ([pricing](https://prod.cursor.com/help/account-and-billing/pricing)). | Retrieval and execution are bundled. `.cursorignore` is not a complete security boundary: official docs say terminal and MCP tools are not blocked by it and protection is not guaranteed ([ignore docs](https://prod.cursor.com/docs/reference/ignore-file)). |
| **GitHub Copilot coding agent** | The cloud agent researches the repository, plans, changes a branch, runs checks, and opens a PR; it supports instructions, memory, custom agents, MCP, skills, and hooks ([cloud agent](https://docs.github.com/en/copilot/concepts/agents/coding-agent/about-coding-agent)). Individual plans range from Free to $100/mo; Business is $19/seat/mo and Enterprise $39/seat/mo ([plans](https://docs.github.com/en/copilot/get-started/plans)). `preToolUse` hooks can allow, deny, ask, or modify, and `postToolUse` can support audit trails ([hooks reference](https://docs.github.com/en/copilot/reference/hooks-reference), [SDK hooks](https://docs.github.com/en/copilot/how-tos/copilot-sdk/features/hooks)). | “Policy hooks plus an audit log” is already a platform feature. Some documented timeout and HTTP-hook paths fail open, so Locus must make a CI/merge decision authoritative instead of treating an advisory hook as containment. |
| **OpenAI Codex** | Local and cloud agents support parallel work, isolated worktrees/containers, tests, review, GitHub delivery, skills, and automations ([Codex app](https://openai.com/index/introducing-the-codex-app/)). Codex sandboxes restrict writes and network and can require approval for elevated actions ([safety](https://openai.com/index/running-codex-safely/)). It is included in free and paid ChatGPT plans, with usage depending on plan and model ([pricing](https://chatgpt.com/codex/pricing/)). | Do not build another agent shell. Integrate with Codex and add a portable task/PR contract that its native sandbox does not publicly provide. |
| **Claude Code** | Claude Code searches, edits, tests, and opens PRs across terminal, IDE, web, GitHub, Slack, and mobile surfaces. Pro is $20/mo; Max is $100 or $200/mo ([product](https://claude.com/product/claude-code)). It has allow/ask/deny permissions and OS-level filesystem/network sandboxing ([permissions](https://code.claude.com/docs/en/permissions), [sandbox](https://code.claude.com/docs/en/sandboxing)). | Native file rules are meaningful competition. Official docs also distinguish Bash from built-in read/edit rules, and sandbox availability/fallback configuration matters. A Locus boundary must be physically enforced or merge-gated, not merely prompted. |
| **Greptile** | Graph-based full-codebase context supports recursive investigation and impact-aware review ([graph](https://www.greptile.com/docs/how-greptile-works/graph-based-codebase-context)). Starter is free; Pro is $30/seat/mo with included credits and $1 additional credits; Enterprise is custom ([pricing](https://www.greptile.com/pricing)). | Code graphs, review findings, and runtime evidence are not unique. |
| **Sourcegraph** | Code Search handles exact/regex/symbol/commit/diff search across repositories; Deep Search performs agentic investigation in a read-only, networkless sandbox and respects repository permissions ([Code Search](https://sourcegraph.com/docs/code-search), [Deep Search](https://sourcegraph.com/docs/deep-search)). Current Enterprise pricing is not public. | Multi-repository search is mature infrastructure. Locus should not become enterprise code search. |
| **Amp** | Amp supplies a multi-model coding agent, persistent Threads, cloud Orbs, GitHub workflows, automations, and agent-to-agent work ([docs](https://ampcode.com/docs)). Megawatt is $20/mo and Gigawatt $200/mo, with model/tool usage billed separately ([pricing](https://ampcode.com/docs/pricing)). | Context continuity and execution are already sold. Locus should govern Amp rather than copy it. |
| **Augment Code** | Context Engine provides semantic, relationship-aware, cross-repository retrieval through MCP and TypeScript/Python SDKs for other agents ([Context Services](https://docs.augmentcode.com/context-services/overview)). Standard is $20/mo and Business $100/mo, each with equal included usage; Enterprise is custom ([pricing](https://www.augmentcode.com/pricing)). | “Universal context for fewer tokens” is a direct commercial collision. |
| **archex** | The Apache-2.0 project already ships local deterministic BM25F retrieval, optional vector/SPLADE signals, graph/type expansion, intent-routed token budgets, blast-radius analysis, freshness/completeness/omission receipts, CLI/MCP/Python/Docker packaging, and setup for several agents ([official repository](https://github.com/Mathews-Tom/archex)). | This is the decisive comparison: a better retriever or richer context receipt would make Locus a weaker duplicate. Archex hooks are documented as non-blocking/diagnostic; Locus can differentiate only if its boundary is enforceable and carried through the exact reviewed candidate. |

### What the research changes

Repository retrieval is important, but it is not a stable standalone moat:

- [Agent Retrieval Bench](https://arxiv.org/abs/2607.24882) isolates five
  next-context tasks over 427 samples from 25 repositories. The authors report that no
  retrieval family wins every task, RepoMap has the best reported budgeted yield at an
  8K-token budget, and logged agents miss every gold file on 27–35% of samples.
- [ContextBench](https://arxiv.org/abs/2602.05892) evaluates 1,136 issue-resolution
  tasks from 66 repositories across eight languages with human-annotated context. Its
  reported agents favor recall over precision, complex scaffolding adds only marginal
  retrieval gains, and explored context differs substantially from used context.
- A 2026 study of [role-aware repository representations](https://arxiv.org/abs/2607.11046)
  reports up to 40% Hit@5 for role-aware summaries over file-path representations and a
  10.4–20.9x smaller footprint than raw source; mixed representations and reranking
  improve results further. Representation and routing matter, not just graph size.
- [RepoGraph](https://github.com/ozyyshr/RepoGraph) and
  [LocAgent](https://aclanthology.org/2025.acl-long.426/) show that file/symbol/import/
  invocation/inheritance graphs can improve multi-hop localization. Graph navigation
  is valuable prior art, not a unique product category.
- The original [SWE-bench](https://arxiv.org/abs/2310.06770) established realistic
  repository issue resolution. OpenAI later documented contamination and test-quality
  problems in SWE-bench Verified and stopped recommending it for frontier comparison
  ([audit](https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/)).
  Any Locus agent score must publish the exact task set, model, harness, retries,
  tool policy, and failures.

The implication is not “stop improving localization.” Locus should add symbol/call/
configuration signals and public retrieval evaluation. The implication is that
**retrieval quality is an enabling component, not the company wedge**.

## The single feature to build next: Locus Guard

Build **Locus Guard — an Agent PR Firewall**: a vendor-neutral, task-derived scope
contract that governs an agent's work and produces a verifiable receipt for the exact
candidate proposed for merge.

The product contract should be:

1. **Freeze scope before execution.** Bind the task, evidence, repository, base commit,
   admitted paths, excluded paths, sensitive path classes, inclusion reasons, and
   policy version into a canonical `locus-scope.json` hash.
2. **Enforce a positive boundary.** Run the supported agent in a materialized
   Slice-only workspace or a fail-closed OS/filesystem adapter. Files outside the
   manifest are not directly readable or writable. A plain MCP response is labeled
   “context guidance,” never enforcement.
3. **Make expansion explicit.** Any outside access becomes a **Widen** request with
   path, evidence, reason, actor/policy decision, timestamp, and successor manifest
   hash. The old manifest remains addressable.
4. **Verify separately.** Freeze the proposed bytes, replay them on the trusted base in
   a fresh full-repository verifier with network denied, and bind every allowed check
   result to the candidate hash.
5. **Merge-gate the exact candidate.** A GitHub Check verifies that the PR head/candidate
   hash, manifest chain, denied-access ledger, checks, review, and usage record agree.
   Inline hooks improve feedback, but CI is authoritative when a host hook is absent or
   fail-open.
6. **Emit a signed receipt.** Attest the verified bundle: task/base SHA, manifest chain,
   denied attempts, Widens, candidate hash, checks, human Review, agent/model/harness
   versions, and provider-reported cost. GitHub artifact attestations use Sigstore to
   sign provenance and support policy verification ([GitHub documentation](https://docs.github.com/en/actions/concepts/security/artifact-attestations)).
   Signing proves origin and integrity—not correctness or safety.

The minimum user story is concrete:

```text
locus guard run --agent codex --task "fix duplicate invoice retries"
  -> admits 9 files, excludes 1,842
  -> blocks 2 outside reads
  -> records 1 justified Widen
  -> verifies candidate 8f91... against base 3a42...
  -> posts a GitHub Check with a signed, machine-verifiable receipt
```

### Why this feature, not the alternatives

| Alternative | Decision | Reason |
| --- | --- | --- |
| Improve the retriever and sell “better context” | **Do not make this the next product.** | Augment, archex, Aider, Sourcegraph, Greptile, and the research already cover multi-signal retrieval, graphs, token budgets, and receipts. |
| Open the existing self-serve coding agent | **Do not launch yet.** | It enters a distribution and capability contest against Devin, Cursor, Copilot, Codex, Claude Code, and Amp before Locus has completed its own canary/soak gates or outcome study. |
| Build another PR-review bot | **Do not prioritize.** | Greptile, Copilot, Codex, Devin, Cursor, and Augment already sell review. |
| Build generic allow/deny hooks or an audit dashboard | **Insufficient.** | Copilot, Devin, Claude Code, Codex, and Cursor already expose varying forms of permissions, hooks, isolation, and logs. |
| Build the task-derived Agent PR Firewall | **Build and test.** | It combines positive task scope, explicit scope expansion, exact-candidate verification, merge enforcement, human decision, and accepted-outcome economics across vendors. No reviewed public source describes that complete chain; that is a documentation finding, not proof no private equivalent exists. |

### Why it is feasible for Locus

Locus already contains most of the hard internal primitives:

| Existing primitive | Reuse in Locus Guard | Missing product work |
| --- | --- | --- |
| Task-to-Slice graph and included/excluded ledger ([agent tools](https://github.com/taranggoyal70/locus/blob/ab3c8c89f49de8fcdc4e4de72fbfdde55d8ae4d9/src/lib/agent/coding-agent.ts)) | Initial positive allowlist and evidence | Canonical manifest schema and stable package/API |
| `widen_file` with a required reason and protected critical paths ([agent tools](https://github.com/taranggoyal70/locus/blob/ab3c8c89f49de8fcdc4e4de72fbfdde55d8ae4d9/src/lib/agent/coding-agent.ts)) | Widen event ledger | Policy/human decisions and successor-manifest chain |
| Frozen candidate digest and deterministic review diff ([candidate hardening](https://github.com/taranggoyal70/locus/blob/ab3c8c89f49de8fcdc4e4de72fbfdde55d8ae4d9/docs/operations/candidate-integrity-hardening.md)) | Bind review and PR head to exact bytes | Portable receipt and GitHub Check |
| Fresh verifier, byte re-hash, approved commands, network denied ([verification](https://github.com/taranggoyal70/locus/blob/ab3c8c89f49de8fcdc4e4de72fbfdde55d8ae4d9/src/lib/agent/verification.ts)) | Authoritative check evidence | Full-repository CI adapter and failure UX |
| Review separated from external delivery ([ADR-0002](https://github.com/taranggoyal70/locus/blob/ab3c8c89f49de8fcdc4e4de72fbfdde55d8ae4d9/docs/adr/0002-separate-review-from-external-delivery.md)) | Human decision bound to proposal hash | Team policy, retention, export, and signature verification |

Start with Codex and Claude Code, whose local workspace/sandbox controls make a
fail-closed adapter plausible. For Cursor, do not rely on `.cursorignore`; expose a
physically restricted workspace. For Copilot's cloud agent, treat the merge check as
authoritative because Locus cannot assume every hook invocation is fail-closed. For
Devin, translate existing Security Profiles and CLI rules instead of asking enterprise
customers to duplicate them.

## Explicit risks

1. **False-negative scope can reduce quality.** The firewall must make Widen fast and
   measurable. A low token count with rejected patches is not a win.
2. **Containment is adversarial engineering.** Shells, symlinks, generated files,
   package scripts, caches, subprocesses, and tool-specific escape hatches need a
   threat model and external security review. Unsupported adapters must be called
   advisory.
3. **Tests often need the full repository.** Give the agent bounded feedback, then run
   authoritative checks in a separate full-repository verifier. Do not expose the full
   tree to the editing agent merely because CI needs it.
4. **Vendor controls will improve.** The moat cannot be a JSON schema. It must become
   the cross-agent integration surface and, with customer consent, the evidence linking
   task → scope → Widen → candidate → check → human decision → cost.
5. **Receipts can leak sensitive metadata.** Redact secrets/tool payloads, minimize
   retained paths and outputs, isolate tenants, and define retention before pilots.
6. **A signature can be misunderstood.** An attestation proves who produced which
   receipt from which workflow. It does not prove the task was solved or the patch is
   secure; GitHub's own documentation makes this distinction.
7. **The buyer may not care enough.** Security/platform teams may prefer native vendor
   controls or faster agents. Paid pilot conversion, not demo enthusiasm, is the test.
8. **The feature is copyable.** Do not claim durable defensibility until repeated,
   permissioned outcome data demonstrably improves policies or evaluation.

## Thirty-day validation plan

This plan validates the startup thesis before broadening the autonomous agent.

### Days 1–5 — freeze the customer and contract

- Keep public Agent admission invite-only and finish the existing canary/alert/browser/
  rollback gates.
- Interview **10 engineering-platform, AppSec, or developer-productivity leads** at
  teams actively using at least two coding agents. Require a recent agent-created PR,
  its review thread, and the current policy/audit workflow; do not count opinion-only
  interviews.
- Secure **three design partners**, each committing five fresh tasks and one operator.
- Publish v0 of the scope manifest, Widen event, receipt, threat model, and explicit
  claims boundary. Bind every object to task ID, repository, base SHA, and prior hash.

### Days 6–14 — build the narrow prototype

- Ship a local CLI adapter for Codex and Claude Code that exposes only the Slice,
  records denied attempts, and requires Widen for outside paths.
- Reuse Locus's frozen-candidate and fresh-verifier path; return only bounded check
  output to the editing agent.
- Add a GitHub Check that rejects a PR when its candidate hash, manifest chain, or
  required checks do not match. Emit deterministic JSON plus a human-readable report.
- Sign the verified receipt with GitHub artifact attestations or a directly managed
  Sigstore path. Keep unsigned/local mode explicit.

### Days 15–24 — run a paired study

Run at least **20 fresh paired tasks** on immutable partner snapshots: same task,
model, prompt, retry budget, and agent harness; Guard on versus normal full-workspace
access. Blind reviewers to the arm. Publish every failure.

Predeclare these gates:

- human acceptance at least **80%** and no more than **5 percentage points** below the
  control arm;
- median provider-reported total tokens per accepted task at least **30% lower**;
- **zero unauthorized reads or writes** in adversarial tests, and 100% of attempted
  denials present in the receipt;
- at least 90% of accepted tasks complete with **two or fewer Widens**;
- no critical correctness, secret-exposure, data-loss, or candidate/receipt mismatch;
- GitHub verification rejects 100% of deliberately altered manifests, candidate
  hashes, check bundles, and signatures.

These are proposed decision thresholds, not current results.

### Days 25–30 — test self-service and payment

- Have all three partners install and operate the prototype without the founder driving
  the task.
- Require at least two teams to complete three or more real tasks each and sign a paid,
  time-bounded pilot for policy, evidence retention, and cross-agent reporting.
- Publish the methodology, aggregate results, confidence intervals where meaningful,
  all critical failures, and task-level retrieval/usage artifacts that can be shared.

### Go / iterate / stop

- **Go:** all safety/integrity gates pass, quality is non-inferior, the token threshold
  holds on accepted tasks, and at least two teams pay for continued use.
- **Iterate:** safety and quality pass, but Widen friction or token savings miss the
  threshold; adjust the boundary/retrieval policy without broadening the product.
- **Stop the standalone startup thesis:** any containment/integrity failure remains, the
  quality gap stays above five points after one predeclared calibration, or fewer than
  two teams will pay. In that case, keep localization open-source and treat it as a
  component rather than a company.

## Claims Locus must not make

1. **“Production-ready self-serve coding agent.”** Production health is necessary,
   but the signed-in canary, soak, accessibility, alert, rollback, and protection gates
   remain incomplete and admission is invite-only.
2. **“First context engine,” “unique graph,” or “unique context receipt.”** Augment,
   archex, Aider, Sourcegraph, Greptile, and the cited research are direct prior art.
3. **“100% recall” without the denominator and fallback rule.** The current figure is
   only the 15 retained author-owned cases, and whole-Repo Widen guarantees recall on
   two of them.
4. **“53% token savings.”** It is estimated median admitted-context reduction, not
   provider-reported total cost per accepted task.
5. **“Safe” or “least privilege” for normal MCP use.** MCP guidance cannot constrain an
   agent that retains unrestricted file or shell access.
6. **“Verified completion.”** Passing checks is factual evidence; human Review decides
   whether the task met its criteria.
7. **“Signed means secure.”** A valid receipt signature establishes integrity and
   provenance, not correctness, harmlessness, or task success.
8. **“No competitor does this.”** The supported wording is: “No reviewed public
   documentation describes the complete cross-agent chain from task-derived positive
   scope through Widen and exact-candidate verification to human outcome and cost.”
9. **A benchmark advantage without a reproducible matched run.** Do not compare unlike
   SWE-bench variants, harnesses, models, retry policies, or dates.
10. **A data moat or academic novelty.** Those require lawful data rights, measured
    learning effects, broader prior-art review, and—if desired—legal analysis.

## Bottom line

Locus has a credible technical kernel but not yet a launch-ready autonomous product or
validated startup. Better retrieval alone is crowded, and archex removes the easiest
open-source differentiation. The highest-leverage next build is **Locus Guard: a
cross-agent Agent PR Firewall that turns task scope, Widens, the exact candidate,
checks, human Review, and cost into one enforceable and signed chain**.

If that chain preserves accepted-task quality, materially reduces total usage, blocks
scope violations, and earns two paid pilots in 30 days, Locus has a focused wedge. If
it does not, broad public launch would amplify an unvalidated product rather than
create a startup.

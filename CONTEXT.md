# Locus — Context

Locus maps a task ("fix the dashboard") to a focused **Slice** of a JavaScript or
TypeScript Repo, instead of always loading the whole tree. It **Widens** when the available
evidence is weak. This is a conservative fallback, not a quality guarantee. This
file is the second-brain: read it once instead of re-crawling the repo.

## Language

Use these terms exactly. They name the domain; the architecture vocabulary
(module, seam, depth, adapter) lives in the review skill's LANGUAGE.md.

**Repo** (`RepoData`):
A codebase loaded into Locus as a flat `path → contents` map plus metadata
(`root`, `recentlyChanged`; source CLI/MCP local Repos also carry `dir`, the
absolute directory they were read from). The unit everything operates on,
regardless of whether it came from a bundle, GitHub, or a local directory.
_Avoid_: project, codebase (as a type), tree; and do not confuse a local
Repo's `dir` (where it was read from) with `GraphNode.dir` (the top-level folder
under `root`). They are unrelated.

**Repo-relative path** (`path`) / **source-root-relative path** (`rel`):
The two spellings every file in a Repo has. `path` is its key in `Repo.files`
and opens next to a local Repo's `dir` when an output surface names that
directory; `rel` is the same file with the `root` prefix stripped, and exists
for display only. On a Repo whose `root` is `src`, one file is both
`src/lib/date.ts` and `lib/date.ts`. A `rel` handed to someone who will open it
is a bug: it may not exist, or worse, may exist in a different repository.
_Avoid_: filename, "relative path" unqualified (say which of the two).

**Surface**:
A user-facing entry point — a route/page — that a task can anchor to. Discovered
structurally (`app/**/page.tsx`), not guessed.
_Avoid_: route (as the domain concept), endpoint, view.

**Anchor**:
A file whose path or source strongly matches the task. Surfaces are useful
Anchors, but hooks, API handlers, components, and libraries can anchor directly.
A task with no confident Anchor triggers **Widen**.
_Avoid_: seed, guessed file.

**Slice**:
The focused candidate set built from Anchors, dependency **Closures**, direct
consumers, and relevant **Recent** files. It is ranked by Recent signal and
distance. It is not claimed to be mathematically minimal or complete.
_Avoid_: subset, scope (noun), selection, context (overloaded).

**Closure**:
The transitive set of files reachable from a node by following import edges to
other **Graph** nodes. The Slice is a Closure rooted at the Anchor.
_Avoid_: dependencies (too broad — a Closure is rooted and transitive).

**Localize** (`locate`):
The core operation: task + Repo → **LocateResult** (the Slice, the excluded
files, and the token saving). The whole product in one verb.
_Avoid_: search, retrieve, query, scope (verb).

**Widen**:
The conservative behavior used when no file anchors a task with enough evidence:
return the whole loaded Repo instead of a speculative small Slice. A
`LocateResult` carries `widened: true` plus **Refinement** guidance: unmatched
task terms, low-confidence candidate files, and real Repo terms. This reduces
localization risk but does not prove agent success.
_Avoid_: fallback, default, expand.

**Refinement** (`LocateRefinement`):
Actionable guidance returned after Widen so the developer can add a filename,
symbol, Surface, error, or repository-specific term without guessing. Refinement
never narrows the Slice by itself.
_Avoid_: recommendation engine, auto-fix, confidence score.

**Recent signal**:
Recently-changed files (from git / the GitHub commits API), surfaced to the top of
a Slice so a cross-cutting bug (a shared util that broke the dashboard) isn't
missed even though it lives outside the obvious folder.
_Avoid_: hotspot, churn.

**RepoSource**:
Where a Repo comes from — a **Bundled** demo (`public/repos/*.json`) or a **GitHub**
fetch. One interface, two adapters; the app holds a RepoSource, not a fetch branch.
_Avoid_: loader, provider, fetcher.

**Task Evidence** (`TaskEvidence`):
Ephemeral text extracted from a screenshot, PDF, DOCX, Markdown, or text file.
Evidence strengthens Anchor matching but never replaces or mutates the user's
task. It is held in React memory for the current page only and is not persisted.
_Avoid_: knowledge base, document store, uploaded asset.

**Agent Task**:
A user-owned engineering outcome: Repo reference, base ref, task description,
acceptance criteria, and one or more execution **Runs**. It describes what should
change; it does not contain mutable execution state.
_Avoid_: saved analysis, prompt, chat.

**Run**:
One durable attempt to complete an Agent Task. A Run owns its status, model,
provider, **Agent execution mode**, Sandbox identity, Slice ledger, Steps,
Artifacts, Reviews, Approvals, and token usage.
_Avoid_: session, conversation, request.

**Agent execution mode** (`AgentExecutionMode`):
The provider-capacity source frozen onto a Run at admission. `shared` uses
Locus's reviewed Cloudflare Workers AI connection and its global daily claim;
`byok` uses the Run owner's saved **Provider connection** and an owner-isolated
capacity lease. The mode never changes during a Run and never selects a
different model or data policy.
_Avoid_: plan, tier, billing mode, provider fallback.

**Provider connection**:
A user-owned Cloudflare Account ID and Workers AI API token, encrypted before
storage and read only by server-side Agent execution. User-facing surfaces
expose connection status, never the stored identifier, token, or ciphertext.
Removing it deletes the stored credential; it does not rewrite existing Runs.
_Avoid_: API key record, integration secret, shared credential.

**Provider daily claim**:
The durable, atomic UTC-day admission record for shared Agent capacity. A claim
survives Run failure so retrying cannot multiply free-provider usage. It is
distinct from the short-lived provider capacity lease that prevents concurrent
use while a Run is active.
_Avoid_: per-user quota, reservation, billing record.

**Step**:
An ordered, auditable unit inside a Run: Localize, plan, tool, Widen, verify,
approval, or delivery. Steps are append-only evidence of what the agent did.
_Avoid_: message, log line.

**Artifact**:
A reviewable Run output such as a plan, diff, test result, build result, pull
request, preview, or final summary.
_Avoid_: attachment, output blob.

**Check evidence**:
The exact command, exit status, and relevant output recorded by a Run. Passing
Check evidence is factual but does not by itself prove the requested behavior or
the Agent Task's acceptance criteria.
_Avoid_: verification proof, task success, quality guarantee.

**Review-ready proposal**:
A Run's reviewable change set together with its Slice ledger, Steps, Artifacts,
Check evidence, and factual token usage. It is ready for human inspection but is
not an approved delivery or a verified Agent Task outcome.
_Avoid_: completed task, verified change, pull request.

**Review**:
An immutable, human criterion-by-criterion decision bound to the exact hash of a
Review-ready proposal. A Review accepts or rejects the Agent Task outcome; it
does not authorize an external write. An **Approval** remains a separate,
capability-specific decision for delivery, deployment, or another side effect.
_Avoid_: approval (for task correctness), verification proof, delivery consent.

**Token ledger**:
The complete input and output token usage for a Run, compared with a declared
whole-context baseline. Cached input is reported but never double-counted.
Savings are claimed only for a verified task outcome.
_Avoid_: prompt tokens (too narrow), estimated savings without an outcome.

**Savings claim**:
The user-facing total-token reduction attached to a successful Run only after a
paired whole-Repo baseline satisfies the same acceptance criteria. Estimated
admitted-context reduction and factual Run usage are not Savings claims. Savings
claims are unavailable during the controlled alpha.
_Avoid_: estimated savings, projected savings, savings on failed Runs.

**Sparse graph signal**:
The `LocateResult` warning that dependency imports resolved at fewer than 0.6
edges per Graph node. On a non-widened Slice this means the reduction may be an
unresolved-import artifact, so user-facing and agent-facing surfaces must carry
the warning next to token-reduction context.
_Avoid_: treating a small Slice from a sparse Graph as proven localization.

**Run evidence snapshot**:
The durable, ownership-checked read model for one Run: its Agent Task, current
status, append-only Steps, Artifacts, Reviews, Approvals, Token ledger, and optional
Savings claim. It is the interface used for refresh, history, and review.
_Avoid_: response payload, session state, activity feed.

## Where it lives (read these, don't re-crawl)

- `src/lib/types.ts` — the web/API **Repo**, `Graph`, and **LocateResult**
  shapes. Every path appears in both spellings: `rel` for display beside other
  rel values in the UI, and `path`/`anchorPaths`/`excludedPaths`/
  `candidateFilePaths` for anything a reader opens. `LocateResult` also owns
  the **Sparse graph signal** fields.
- `bin/core.mjs` — the zero-dependency CLI/MCP port of `buildGraph`/`locate`,
  plus local-Repo loading with an analyzed `dir` and the three openable-path
  output surfaces (`formatResult`, `buildPackedContext`, `buildJsonResult`).
  Copied verbatim into `cli/` by `pnpm sync-cli`; `pnpm check-sync` fails the
  build if the two drift.
- `src/lib/localizer.ts` — **Localize**: `buildGraph(repo)` then `locate(task, repo, graph)`.
  `buildGraph` is separate on purpose — build once, **Localize** many as the task changes.
- `src/components/ErrorBoundary.tsx` — React error boundary for graceful crash recovery.
- `src/lib/sources.ts` — the **RepoSource** interface + Bundled/GitHub adapters.
- `src/hooks/useLocus.ts` — owns the interaction state (repo, task, selection); the page is a thin view over it.
- `src/app/api/github/route.ts` — the GitHub transport for the GitHub RepoSource.
- `src/app/api/attachments/route.ts` — authenticated in-memory document extraction.
- `src/components/TaskEvidence.tsx` — attachment UI and browser-only screenshot OCR.
- `src/components/DependencyGraph.tsx` — three-stage context trace; recolours by **Slice**.
- `src/lib/agent/run-state.ts` — valid **Run** lifecycle transitions and
  verified-only **Savings claim** rules.
- `src/lib/agent/run-store.ts` — guarded Run mutations and append-only Step writes.
- `src/lib/agent/run-view.ts` — the shared **Run evidence snapshot** interface.
- `src/components/AgentRunsList.tsx` — durable Run history, review, resume,
  cancellation, and approval.
- `supabase/migrations/005_agent_runs.sql` — durable Agent Tasks, Runs, Steps,
  Artifacts, and Approvals.
- `supabase/migrations/012_release1_run_evidence.sql` — immutable proposal
  hashes, Reviews, and atomic review-ready publication.
- `supabase/migrations/018_free_public_beta.sql` — frozen provider and **Agent
  execution mode**, encrypted **Provider connections**, and atomic **Provider
  daily claims**.

## Invariants

- **Widen on weak evidence.** `locate` must never return a partial/empty Slice silently; if it cannot anchor, it widens to the whole loaded Repo.
- **Deterministic source graph.** The dependency **Graph** comes from parsing
  imports between JavaScript/TypeScript nodes, never from an LLM. Non-source
  files may exist in `Repo.files`, but imports to them are not Graph edges or
  Slice files.
- **CLI/MCP emitted paths are openable.** Anything the source CLI or MCP server
  renders for a human or an agent to open is a **repo-relative path**, stated
  together with the local Repo `dir` it is relative to; a
  **source-root-relative path** never stands alone in that output. The analyzed
  directory is not the reader's cwd (`locus locate --path ../other`, a
  multi-root MCP client), so naming it is what makes the rest resolvable. The
  CLI and MCP surfaces enforce this: they refuse to render a local Repo that
  cannot state its `dir`. The web Copy/Download export and `/api/v1/locate` hold
  the same invariant without a `dir`, because their paths are relative to the
  repository the caller named: the checkout is the reader's own, so the root is
  already known to them.
- **`buildGraph` is pure and reused.** One Graph per Repo, many Localize calls across task changes.
- **Claims follow evidence.** `benchmarks/` measures historical fix-file recall and estimated context reduction; it does not claim autonomous task completion.
- **No skipped gates.** A Run cannot complete without passing Check evidence and
  an explicit Review; terminal Runs cannot be rewritten.
- **Steps are append-only.** Current Run status is a projection; completed Step
  evidence is inserted once and never rewritten to simulate progress.
- **No outcome, no claim.** Failed, cancelled, and active Runs expose measured
  usage but never display a Savings claim.
- **Checks are evidence, not outcomes.** A zero exit status is Check evidence;
  acceptance-criteria satisfaction remains a separate review decision.
- **Measure the whole loop.** The USP is total tokens per verified task—not the
  size of the initial prompt alone.

## Example dialogue

> **Dev:** The dashboard chart is broken — where do I look?
> **Locus:** I anchored that task on the `dashboard` Surface and took its Closure —
> a 10-file Slice. The other 19 files (cohorts, reports, roster) are excluded.
> **Dev:** Could the bug be in a shared helper, though?
> **Locus:** Shared helpers in the Closure are still in the Slice — and `date.ts`
> changed recently, so the Recent signal floated it to the top.
> **Dev:** What if I describe something you don't recognise?
> **Locus:** Then I Widen — no confident Anchor means I return the whole loaded
> Repo rather than pretending a narrow Slice is sufficient. I also show which
> words were not found and offer real Repo terms you can add to the task.

# Locus — Context

Locus maps a task ("fix the dashboard") to a focused **Slice** of a TypeScript
Repo, instead of always loading the whole tree. It **Widens** when the available
evidence is weak. This is a conservative fallback, not a quality guarantee. This
file is the second-brain: read it once instead of re-crawling the repo.

## Language

Use these terms exactly. They name the domain; the architecture vocabulary
(module, seam, depth, adapter) lives in the review skill's LANGUAGE.md.

**Repo** (`RepoData`):
A codebase loaded into Locus as a flat `path → contents` map plus metadata
(`root`, `recentlyChanged`). The unit everything operates on, regardless of
whether it came from a bundle or GitHub.
_Avoid_: project, codebase (as a type), tree.

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
The transitive set of files reachable from a node by following imports. The Slice
is a Closure rooted at the Anchor.
_Avoid_: dependencies (too broad — a Closure is rooted and transitive).

**Localize** (`locate`):
The core operation: task + Repo → **LocateResult** (the Slice, the excluded
files, and the token saving). The whole product in one verb.
_Avoid_: search, retrieve, query, scope (verb).

**Widen**:
The conservative behavior used when no file anchors a task with enough evidence:
return the whole loaded Repo instead of a speculative small Slice. A
`LocateResult` carries `widened: true`. This reduces localization risk but
does not prove agent success.
_Avoid_: fallback, default, expand.

**Recent signal**:
Recently-changed files (from git / the GitHub commits API), surfaced to the top of
a Slice so a cross-cutting bug (a shared util that broke the dashboard) isn't
missed even though it lives outside the obvious folder.
_Avoid_: hotspot, churn.

**RepoSource**:
Where a Repo comes from — a **Bundled** demo (`public/repos/*.json`) or a **GitHub**
fetch. One interface, two adapters; the app holds a RepoSource, not a fetch branch.
_Avoid_: loader, provider, fetcher.

## Where it lives (read these, don't re-crawl)

- `src/lib/types.ts` — every shape above (**Repo**, `Graph`, **LocateResult**).
- `src/lib/localizer.ts` — **Localize**: `buildGraph(repo)` then `locate(task, repo, graph)`.
  `buildGraph` is separate on purpose — build once, **Localize** many as the task changes.
- `src/lib/layout.ts` — pure graph → positions (the **Graph** view's math; testable without React).
- `src/lib/sources.ts` — the **RepoSource** interface + Bundled/GitHub adapters.
- `src/hooks/useLocus.ts` — owns the interaction state (repo, task, selection); the page is a thin view over it.
- `src/app/api/github/route.ts` — the GitHub transport for the GitHub RepoSource.
- `src/components/DependencyGraph.tsx` — renders `src/lib/layout.ts`; recolours by **Slice**.

## Invariants

- **Widen on weak evidence.** `locate` must never return a partial/empty Slice silently; if it cannot anchor, it widens to the whole loaded Repo.
- **Deterministic graph.** The dependency **Graph** comes from parsing imports, never from an LLM.
- **`buildGraph` is pure and reused.** One Graph per Repo, many Localize calls across task changes.
- **Claims follow evidence.** `benchmarks/` measures historical fix-file recall and estimated context reduction; it does not claim autonomous task completion.

## Example dialogue

> **Dev:** The dashboard chart is broken — where do I look?
> **Locus:** I anchored that task on the `dashboard` Surface and took its Closure —
> a 10-file Slice. The other 19 files (cohorts, reports, roster) are excluded.
> **Dev:** Could the bug be in a shared helper, though?
> **Locus:** Shared helpers in the Closure are still in the Slice — and `date.ts`
> changed recently, so the Recent signal floated it to the top.
> **Dev:** What if I describe something you don't recognise?
> **Locus:** Then I Widen — no confident Anchor means I return the whole loaded
> Repo rather than pretending a narrow Slice is sufficient.

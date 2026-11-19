<div align="center">

# Locus

**Show your coding agent only the code it needs, and prove what it touched.**

[Live product](https://locus-five-iota.vercel.app) · [Measured results](#measured-results) · [How it works](#how-it-works) · [Quick start](#quick-start) · [CLI and MCP](#use-it-from-an-agent) · [Status and limits](#status-and-limits)

[![CI](https://github.com/taranggoyal70/locus/actions/workflows/ci.yml/badge.svg)](https://github.com/taranggoyal70/locus/actions/workflows/ci.yml)
[![Tests: 978 passing](https://img.shields.io/badge/vitest-978%20passing-087864)](#verify-a-checkout)
[![Held-out recall](https://img.shields.io/badge/held--out%20fix--file%20recall-60%2F60-087864)](benchmarks/heldout/README.md)
[![License: proprietary](https://img.shields.io/badge/license-proprietary-14233b)](LICENSE)
[![Demo](https://img.shields.io/badge/demo-locus--five--iota.vercel.app-14233b)](https://locus-five-iota.vercel.app)

<picture>
  <source media="(max-width: 600px) and (prefers-color-scheme: dark)" srcset="assets/readme/hero-mobile-dark.svg">
  <source media="(max-width: 600px)" srcset="assets/readme/hero-mobile-light.svg">
  <source media="(prefers-color-scheme: dark)" srcset="assets/readme/hero-dark.svg">
  <img src="assets/readme/hero-light.svg" width="100%" alt="Animated replay of a real held-out run on pmndrs/jotai. The task 'vanilla subscriber not notified after nested store.set and sub/unsub inside a write' is typed into locus locate. Of 130 source files, 6 anchors and 11 dependency-closure files light up and 113 are excluded: 17 of 130 files, 17.7K of 62.4K estimated tokens, 72% less context. The file the maintainer actually fixed, src/vanilla/internals.ts, is inside the Slice.">
</picture>

</div>

A coding agent asked to fix one bug usually reads the whole repository. You pay for every token of it, and the
files that matter are buried in the ones that do not. Locus maps a task in plain language to a **Slice**: the
files that match it, their dependency closure, their direct consumers and recent cross-cutting changes. When the
evidence is too weak to commit to a small Slice, it **widens** to the whole repository and says which words it
could not place, instead of guessing.

The Slice then becomes a boundary. **Locus Guard** runs Codex, Claude or any command against only the admitted
files, rejects a candidate that changes anything outside them, and signs the candidate, its checks, usage and
the human review into one Ed25519 receipt.

Locus works on JavaScript, TypeScript and Python. It runs as a hosted web app and REST API, as a source CLI, and
as an MCP server for Claude Code, Codex and Cursor.

## What you get

| Localize a public repository | Contain an agent to the Slice |
| :--- | :--- |
| [![The Locus landing page on the live deployment: paste a public GitHub project and Locus finds the files an AI coding task needs and shows why.](assets/readme/landing.jpg)](https://locus-five-iota.vercel.app) | [![The Locus Guard demo on the live deployment: a duplicate-invoice task, the safe area of seven approved files out of 1,842, and a proof receipt waiting for the merge decision.](assets/readme/guard-demo.jpg)](https://locus-five-iota.vercel.app/demo) |
| Paste a public GitHub project and a task; the workspace shows the anchors, the closure and every excluded file with its reason. | Guard approves the files a task needs, blocks the rest, and signs one receipt for the exact fix. The demo tells an illustrative story about a fictional billing system. |
| **Hold the claim until the evidence exists** | **Call it from code** |
| [![The Release 1 evidence page on the live deployment: the gate is locked at 0 of 40 valid reviewed arm results, with 20 frozen tasks across 5 public repositories and arm-blinded review.](assets/readme/evidence.jpg)](https://locus-five-iota.vercel.app/evidence/release-1) | [![The API documentation on the live deployment: Bearer-token authentication and POST /api/v1/locate.](assets/readme/api-docs.jpg)](https://locus-five-iota.vercel.app/docs) |
| The paired agent study is frozen before it runs, and the public page withholds every outcome metric until all 40 results bind to real Runs and blinded reviews. | `POST /api/v1/locate` returns the Slice, anchors, graph statistics, packed context and refinement guidance for a public repository. |

All four images are unedited captures of the live deployment at 1440 px wide, taken on 2026-11-19.
The hero above is generated from a recorded benchmark run; [asset provenance](assets/readme/README.md).

## Measured results

| Question | Result | Held out how |
| :--- | :--- | :--- |
| Does the Slice contain the files a maintainer changed, on code Locus has never seen? | **60/60 cases** with every fix file in the Slice. On the 57 cases Locus localized, a **72% median** estimated context reduction; a random Slice of the same size would have contained **25.4%** of the fix files. | Six third-party repositories pinned on 2026-11-19, ten most recent qualifying fix commits each, chosen by a written rule and all scored. [Report](benchmarks/heldout/README.md) |
| How much of that depends on the task naming the module? | With the conventional-commit scope removed from every task: **94.4%** fix-file recall, **57/60** complete cases, **6** widened, 71.5% median reduction on localized cases. | The same 60 cases. This ablation was added after the first run, to test it. |
| Does it still work on the project's own history? | **15/15** cases, 53% median reduction, 2 widened. | Not held out: fixes from repositories this project's author owns, gated on full recall. [Suite](benchmarks/README.md) |
| Does a Slice cut total agent tokens without lowering accepted work? | **Not measured yet.** 0 of 40 arm results are recorded, so the gate stays locked and no outcome is claimed. | Frozen paired study with blinded human review. [Protocol](benchmarks/release1/README.md) |

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/readme/heldout-dark.svg">
  <img src="assets/readme/heldout-light.svg" width="100%" alt="Bar chart of fix-file recall on localized held-out cases. Task as written: Locus Slice 100.0%, random Slice of the same size 25.4%, 72% median context saved over 57 cases. Scope word removed: Locus Slice 93.7%, random Slice 26.4%, 71.5% median context saved over 54 cases.">
</picture>

### How the held-out benchmark is built

The historical suite replays fixes from the author's own repositories and fails the build unless every fix file
is found, so it can only ever report 100%. It is a regression gate, not evidence. The held-out benchmark was
written to be the opposite: [`benchmarks/heldout/protocol.json`](benchmarks/heldout/protocol.json) freezes six
TypeScript repositories (honojs/hono, pmndrs/zustand, pmndrs/jotai, h3js/h3, sindresorhus/ky and trpc/trpc) at
fixed commits, and excludes two repositories that were used while developing the resolver. From each, it takes
the ten most recent first-parent commits whose subject starts with "fix" and that modify one to three non-test
source files. The task is the commit subject, mechanically cleaned. Locus runs on the parent snapshot exactly as
the CLI does, and every selected case is reported: the three that widen, and in the ablation the six that widen
and the three that miss a file.

<details>
<summary>What these numbers do and do not show</summary>

- **Recall is not task success.** It says the files a maintainer changed are in the Slice. It does not say an
  agent given that Slice would have fixed the bug, or that every excluded file was unnecessary. The Release 1
  study exists to measure that, and it has not run.
- **Widened cases score full recall by definition** and save nothing. They are counted, and reported separately.
- **Slices are not tiny.** The median localized Slice is 102,159 estimated tokens against a median repository of
  419,031. That is above the 40,000-token default budget for `--pack`, which ranks anchors first and truncates.
- **Token counts are estimates**: Locus's `chars / 4`, not a model tokenizer.
- **Commit subjects are terse and carry no error text.** Real tasks with `--evidence` usually give the matcher
  more to work with; scoped subjects can give it less work than a vague human request.
- **One language family.** All six held-out repositories are TypeScript. Python support is tested but not
  benchmarked here.

Reproduce with `pnpm benchmark:heldout` (clones about 180 MB of public repositories into your temp directory)
and `pnpm benchmark`. Both are deterministic: rerunning them on 2026-11-19 reproduced every committed number.

</details>

## How it works

```mermaid
flowchart TB
    subgraph Input["Input"]
        direction LR
        Task["Task in plain language"]
        Evidence["Optional evidence:<br/>logs, PDFs, screenshots"]
        Repo["Public GitHub repo<br/>or local checkout"]
    end
    subgraph Localizer["Localizer: deterministic, no model calls"]
        direction LR
        Graph["Import graph<br/>TS paths · NodeNext · workspaces · Python"]
        Anchor["Anchor scoring<br/>paths · source · routes · recency"]
        Widen{"Evidence<br/>strong enough?"}
        Closure["Closure +<br/>direct consumers"]
        Whole["Whole repo +<br/>refinement terms"]
        Graph --> Anchor --> Widen
        Widen -->|yes| Closure
        Widen -->|no| Whole
    end
    subgraph Surfaces["Surfaces"]
        direction LR
        Web["Web workspace<br/>and REST API"]
        Agent["Hosted Agent Run<br/>Workflow + Sandbox"]
        CLI["Source CLI<br/>and MCP server"]
    end
    subgraph Guard["Locus Guard"]
        direction LR
        Manifest["Scope manifest<br/>hash kept out of band"]
        Runner["Agent in Seatbelt<br/>or Bubblewrap"]
        Verify["Path gate<br/>+ checks"]
        Receipt["Ed25519 receipt<br/>+ human review"]
        Manifest --> Runner --> Verify --> Receipt
    end
    Input --> Localizer --> Surfaces
    CLI --> Guard
```

1. **Build the graph.** [`buildGraph`](src/lib/localizer.ts) parses `import`, `require()`, dynamic `import()`,
   tsconfig `paths` and `baseUrl`, NodeNext `.js` specifiers that point at `.ts` files, monorepo workspace
   package names, and Python `import` / `from ... import` into a dependency graph. Third-party packages are never
   edges, and a sparse graph is flagged so a reduction figure is not overstated.
2. **Anchor the task.** [`locate`](src/lib/localizer.ts) scores every file against the task's words through its
   path, source text, Next.js route and recent-change history, and keeps up to six anchors. A matching test
   file also pulls in the implementation it covers.
3. **Close over dependencies.** Each anchor brings its import closure and its direct consumers; anchors rank first
   so they survive a token budget.
4. **Widen when unsure.** If the best anchor is weak, the whole repository comes back with the unmatched terms,
   candidate files and repository vocabulary to refine the task.
5. **Contain and sign.** [`locus guard`](bin/guard.mjs) turns the Slice into a manifest, runs the agent against
   only those files in an OS sandbox, rejects any candidate that changes a path outside them, and signs the
   result ([ADR 0003](docs/adr/0003-guard-trusts-an-external-manifest-hash.md),
   [ADR 0004](docs/adr/0004-runner-enforces-a-target-repo-boundary.md)).

The hosted Agent path runs the same localizer, then executes a bounded agent loop in a Vercel Sandbox under a
durable Vercel Workflow, records allowlisted checks, and stops at a review-ready proposal. External GitHub writes
are disabled. [`bin/core.mjs`](bin/core.mjs) is a dependency-free port of the localizer for the CLI and MCP
server; a [parity test](tests/localizer-parity.test.mjs) keeps the two identical.

### Engineering decisions

| Constraint | Approach | Tradeoff |
| :--- | :--- | :--- |
| An agent cannot tell what a small Slice left out, so a confident wrong Slice is worse than a large one. | Widen to the whole repository below a fixed anchor score, and return the terms that matched nothing plus suggested starting files. | A widened run saves nothing: 3 of 60 held-out cases, 6 without scope words. |
| A Slice has to be explainable and reproducible to be reviewed. | Localization is lexical scoring over a parsed import graph: no embeddings and no model calls, so the same input gives the same Slice. | It misses synonyms the code never uses; removing scope words drops held-out recall to 94.4%. |
| An agent with filesystem access can rewrite its own allowlist. | Guard trusts a manifest hash and candidate SHA supplied from outside the branch, and fails closed without them. | CI has to carry the hash out of band; a signature proves provenance and integrity, not correctness. |
| An agent with host access can read the whole repository before the final check. | `guard run` copies the Slice into an ephemeral workspace and runs the agent under macOS Seatbelt or Linux Bubblewrap, refusing if neither exists. | The network is not isolated, and other host-readable data is not concealed. |
| Opening sign-up exposes shared model capacity to the internet. | Each account resolves to one Tier; self-serve needs the exact word `open`, a verified email and an account ceiling; capabilities ship through `CAPABILITY_RELEASE` in code. | Releasing a capability is a reviewed commit, never a dashboard toggle. |
| Stripe delivers webhooks out of order and retries only on failure. | A database function refuses stale or duplicate events in the same statement as the write; the route returns 500 only when the write itself failed. | Billing is withheld in this release, so the path is tested but not exercised by real payments. |

### Technology

| Layer | Used for |
| :--- | :--- |
| **Web app** | Next.js 16 App Router, React 19, Tailwind CSS v4, Vercel Analytics and Speed Insights |
| **Identity and data** | Clerk sessions and email verification; Supabase Postgres, 22 migrations, row-level security |
| **Agent Runs** | Vercel Workflow for durable Runs, Vercel Sandbox for isolated execution, AI SDK against Cloudflare Workers AI |
| **Task evidence** | `unpdf`, `mammoth` and `tesseract.js` extract text from PDFs, DOCX files and screenshots |
| **CLI, MCP and Guard** | Zero-dependency Node ESM; stdio JSON-RPC for MCP; `node:crypto` Ed25519; Seatbelt and Bubblewrap |
| **Billing** | Stripe Checkout and webhooks, withheld by `CAPABILITY_RELEASE` |
| **Verification** | Vitest, Testing Library and jsdom; real CLI and MCP process tests; CodeQL, gitleaks and `pnpm audit` in CI |

## Quick start

Requires **Node.js 22** and **pnpm 11** (`corepack enable`). The CLI and MCP server need no keys and no account.

```bash
git clone https://github.com/taranggoyal70/locus.git
cd locus
pnpm install
node bin/locus.mjs locate "stripe webhook should retry when the subscription write fails"
```

That last command localizes this repository. An excerpt of its real output, which goes on to report 79,238 of
369,231 estimated tokens:

```text
Slice (46 files):
  src/app/api/billing/webhook/route.test.ts  (dist 0, ~1998 tok)  [changed]
  src/app/api/billing/webhook/route.ts  (dist 0, ~1092 tok)  [changed]
  ...
Excluded: 219 files
```

| Mode | Command | What runs |
| :--- | :--- | :--- |
| Localize a checkout | `node bin/locus.mjs locate "<task>" --path <dir>` | The full localizer on your machine. Add `--pack`, `--json` or `--evidence`. |
| MCP server | `node bin/locus.mjs mcp` | A stdio server exposing `locate` to Claude Code, Codex or Cursor. |
| Guard a Run | `node bin/locus.mjs guard init "<task>"`, then `guard run` and `guard verify` | Scope manifest, sandboxed agent, path gate and signed receipt. [Pilot guide](docs/operations/locus-guard-pilot.md) |
| Hosted API | `curl -X POST https://locus-five-iota.vercel.app/api/v1/locate` | Localization of a public GitHub repository with an API key from Settings. |
| Web app | `pnpm dev` | The full product on `localhost:3000`. Needs Clerk and Supabase keys; see [Configuration](#configuration). |

For a local database, the committed Supabase config replays every migration:

```bash
pnpm dlx supabase@2.111.0 start
pnpm dlx supabase@2.111.0 db reset
pnpm dlx supabase@2.111.0 status   # copy the URL and keys into .env.local
```

Hosted databases use the history-aware procedure in
[`docs/operations`](docs/operations/release-1-readiness-rollout.md), never a shell loop over migration files.

## Use it from an agent

| Command | Does |
| :--- | :--- |
| `locus locate "<task>"` | Prints anchors, the Slice with distance and token estimates, and the excluded count |
| `locus locate "<task>" --pack --budget 40000` | Emits a token-bounded, ready-to-paste context block |
| `locus locate "<task>" --json` | The machine-readable result; file fields are relative to `dir` |
| `locus locate "<task>" --evidence "<stack trace>"` | Adds error text to the matcher |
| `locus mcp` | Starts the MCP server: `locate(task, path?, evidence?, pack?)` |
| `locus guard init "<task>"` | Writes a scope manifest and prints its SHA-256 to keep outside the branch |
| `locus guard widen <path> --reason "<why>" --actor "<who>"` | Appends a hash-chained Widen event |
| `locus guard run --agent <codex\|claude\|command> ...` | Runs the agent against the Slice in an OS sandbox |
| `locus guard verify --expected-manifest-hash <sha> --expected-candidate-sha <oid>` | Fails if the candidate changes a path outside the Slice |
| `locus guard review` / `locus guard receipt verify` | Binds an immutable human review; verifies a signed receipt |

`locus` here is `node bin/locus.mjs` from a checkout; no npm package is published. To use the MCP server from
Claude Code or Cursor, point the client at the checkout:

```json
{
  "mcpServers": {
    "locus": {
      "command": "node",
      "args": ["/path/to/locus/bin/locus.mjs", "mcp"],
      "env": { "LOCUS_MCP_ROOTS": "/path/to/your/repo" }
    }
  }
}
```

The server only reads directories inside `LOCUS_MCP_ROOTS` (default: its working directory), compared after
resolving symlinks, so a client cannot widen what it may read.

The REST API takes `repo` (`owner/repo`, `owner/repo@ref` or a GitHub URL), `task`, and optional `evidence` and
`budget`, and returns `slice`, `anchors`, `tokens`, `graph`, packed `context` and `refinement`:

```bash
curl -X POST https://locus-five-iota.vercel.app/api/v1/locate \
  -H "Authorization: Bearer $LOCUS_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"repo": "pmndrs/jotai", "task": "subscriber not notified after nested store.set"}'
```

Rate limit: 30 requests a minute per user. Full reference: [/docs](https://locus-five-iota.vercel.app/docs).

## Configuration

Copy [`.env.example`](.env.example) to `.env.local`. The web app reports which of these are missing at
[`/api/health`](https://locus-five-iota.vercel.app/api/health).

| Variable | Required | Purpose |
| :--- | :---: | :--- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Yes | Clerk sign-in, sessions and email verification |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Yes | Tasks, Runs, evidence, API keys and usage; the service key stays server-side |
| `LOCUS_AGENT_MODEL` | Yes | Must be the reviewed `@cf/qwen/qwen3.8-27b`; any other value fails closed |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | Yes | The shared Workers AI pool for Agent Runs |
| `LOCUS_CREDENTIAL_ENCRYPTION_KEY` | Yes | Base64 32-byte key that encrypts users' own Cloudflare tokens |
| `CRON_SECRET` | Yes | Authorizes the daily retention job in `vercel.json` |
| `OPS_EXTERNAL_HEALTHCHECK` or `OPS_ALERT_WEBHOOK_URL` | One | Operational alerting: `github_actions` for the committed monitor, or an HTTPS webhook |
| `ALPHA_ALLOWED_USER_IDS` | No | Clerk user IDs admitted to the comped `partner` Tier |
| `LOCUS_SELF_SERVE`, `LOCUS_SELF_SERVE_MAX_ACCOUNTS` | No | `open` admits verified accounts to the `free` Tier, up to an optional ceiling |
| `LOCUS_RUN_TOKEN_BUDGET` | No | Token budget for Runs on a user's own credentials; 10,000 to 240,000, default 180,000 |
| `LOCUS_API_ALLOWED_ORIGINS` | No | Browser origins allowed to call the REST API with CORS |
| `GITHUB_TOKEN` | No | Higher GitHub API limits when importing public repositories |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | No | GitHub OAuth; inert while the capability is withheld |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID` | No | Billing; inert while the capability is withheld |
| `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPPORT_URL` | No | Public URLs; detected automatically on Vercel |

The CLI reads `LOCUS_MCP_ROOTS`, `LOCUS_GUARD_SIGNING_KEY` and `LOCUS_GUARD_SIGNER_KEY_ID`; the template
documents them too.

<details>
<summary>Admission and Tiers</summary>

Every signed-in account resolves to one **Tier**, which sets what it may do and how many Agent Runs it may hold.

| Tier | How it is reached | Runs (active / rolling 24 hours) | Public Repos | Non-public Repos | PR delivery |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `visitor` | Signed out, waitlisted or suspended | 0 / 0 | read only | no | no |
| `free` | A verified email while `LOCUS_SELF_SERVE=open` and below the ceiling | 1 / 2 | yes | no | no |
| `partner` | Listed in `ALPHA_ALLOWED_USER_IDS` | 2 / 10 | yes | yes | yes |
| `pro` | An active Stripe subscription | 5 / 50 | yes | yes | yes |

The highest matching Tier wins, and an operator row in `account_admissions` can raise or refuse an account. The
table is the ladder as designed; `CAPABILITY_RELEASE` in [`src/lib/admission.ts`](src/lib/admission.ts) is what
has shipped, and the two are intersected. Today it withholds GitHub connections, non-public Repos, teams, PR
delivery and billing for every Tier.

</details>

## Verify a checkout

```bash
pnpm install --frozen-lockfile
pnpm lint && pnpm typecheck && pnpm test     # 978 tests, no network or keys
pnpm check:merge-markers && pnpm check-sync && pnpm check:alpha-claims
pnpm evidence:release1                       # the public study report matches its inputs
pnpm readme:assets --check                   # the README graphics match their data
pnpm benchmark                               # historical gate (network for two repos)
pnpm benchmark:heldout                       # held-out benchmark (network, about 180 MB)
```

CI runs everything above except the two benchmarks, plus a production build, an audit of every dependency at
high severity, CodeQL and a full-history secret scan. A scheduled workflow probes the production
`/api/health` contract every five minutes.

Most tests replace the Supabase transport. To check the schema itself, replay the migrations into a local
database and run the opt-in suite: `LOCUS_LIVE_DB=1 pnpm test admission-live`.

```text
src/lib/localizer.ts        Graph construction, anchor scoring, closure and Widen
src/lib/admission*.ts       Tiers, self-serve barriers and the capability release record
src/lib/agent/              Agent Run lifecycle, budgets, quotas, Sandbox workspace and verification
src/workflows/agent-run.ts  The durable Workflow behind each Agent Run
src/app/                    Product pages, workspace and every API route
bin/                        Source CLI, MCP server and Locus Guard (core.mjs mirrors the localizer)
cli/                        The thin API client package, not published
supabase/migrations/        22 migrations with row-level security
benchmarks/                 Historical gate, held-out benchmark and the frozen Release 1 study
scripts/                    Benchmarks, release evidence, launch probes and README graphics
docs/adr/, CONTEXT.md       Architecture decisions and the domain language
```

## Status and limits

- **Public beta.** Any verified account can localize a public repository. Agent Runs share one daily slot across
  the beta unless you connect your own Cloudflare account. Non-public Repos, GitHub writes and billing are
  withheld in code.
- **Task success is unmeasured.** The benchmarks above measure whether the right files are in the Slice. Whether
  an agent finishes more tasks, or spends fewer total tokens per accepted task, waits on the Release 1 study.
- **Lexical matching.** A task that uses none of the code's vocabulary widens or misses; `--evidence` and the
  refinement terms are the remedy.
- **The hosted importer is smaller than the CLI.** The web workspace imports public JavaScript and TypeScript
  repositories up to 200 source files; the CLI, MCP server and REST API use the full localizer, including Python
  and single-file components.
- **Guard containment** covers macOS and Linux only, does not isolate the network, and proves which files changed,
  not that the change is right.
- **Uploaded evidence** is processed for text and not intentionally retained, but extracted text becomes part of
  a Run record once submitted.

[Domain language](CONTEXT.md) · [Architecture decisions](docs/adr) · [Guard pilot](docs/operations/locus-guard-pilot.md) · [Security review status](docs/operations/security-review-status.md) · [Changelog](CHANGELOG.md)

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a change; outside contributions need a written agreement
first. Report vulnerabilities privately through [SECURITY.md](SECURITY.md), never in a public issue.

## License

Copyright © 2026 Tarang Goyal. All rights reserved.

Locus is **source-available, not open source**. The code is public so it can be read, evaluated and checked
against the results above. No right to use, copy, modify, distribute, sublicense or sell any part of it is
granted; see [LICENSE](LICENSE). Third-party dependencies keep their own licenses. For commercial terms, get in
touch.

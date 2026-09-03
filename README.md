# Locus

**Review-ready engineering proposals with visible context evidence.**

Locus maps a natural-language task to a focused JavaScript/TypeScript code Slice:
matching files, their dependency closure, nearby integration points, and relevant
recent changes. When the evidence is weak, it returns the whole repo instead of a
speculative small slice and explains which terms were not found, possible starting
files, and repository language that can refine the task. Public early access lets
any signed-in user localize a supported public Repo and inspect the resulting
Slice. Invited design partners can continue into an isolated Sandbox, collect
factual Check evidence, and stop at a review-ready proposal. External GitHub
writes and billing are disabled. Active Runs survive refresh and can be resumed,
cancelled, and reviewed from the Runs ledger.

**Live:** https://locus-five-iota.vercel.app

## Current surfaces

| Surface | Use case |
|---------|----------|
| **Public web early access** | Self-serve localization for public Repos; Agent Runs remain invite-gated |
| **Experimental REST API** | Programmatic localization for public Repos |
| **Source runtimes** | CLI and MCP implementations used from a source checkout; no npm package is published |

## Evidence

The historical-task benchmark replays Locus on the parent snapshots of 15 real
fixes across Locus, Agent Access, and Solum - three repositories owned by this
project's author, so treat it as a regression suite rather than independent
evidence:

- **100% fix-file recall on the 15 cases in the suite.** The suite gates on full
  recall, so a case Locus missed would have to be removed for the build to pass.
  The figure therefore describes the cases retained, and cannot report anything
  other than 100%.
- **53% median estimated context reduction**, over a distribution from 0% to 99%
- **2 conservative whole-repo fallbacks**, which score full recall by definition
  because the whole repository is selected

See [the full method and every case](./benchmarks/README.md), or run:

```bash
pnpm benchmark
```

The replay checks whether Locus includes the files developers changed next. It
does not prove that an autonomous agent completed the task, that every excluded
file was unnecessary, or that agent quality cannot regress.

The separate [Release 1 evidence page](https://locus-five-iota.vercel.app/evidence/release-1)
publishes the frozen paired-study protocol and current completion state. It
withholds outcome metrics until all 40 arm results bind to valid Run, review, and
proposal evidence.

## How it works

1. Parse supported JavaScript/TypeScript `import`, `require()`, dynamic `import()`, and `@/` aliases into a deterministic dependency graph.
2. Match meaningful task words against file paths and source text.
3. Add dependency closures, direct consumers, and recent cross-cutting matches.
4. Widen to all loaded files when the evidence is insufficient, then return
   unmatched terms and concrete refinement suggestions.

### Task evidence

Attach screenshots, PDFs, DOCX files, or plain text to strengthen task matching.
Uploaded binaries are processed for text extraction and are not intentionally retained.
Extracted text can become part of a durable task or Run record when submitted.

### Supported files

- `.ts`, `.tsx`, `.js`, `.jsx`
- Next.js App Router surface detection (any extension)
- `require()` and dynamic `import()` dependency edges

Graph nodes and returned Slices are JavaScript/TypeScript files. Imports that
resolve to non-JavaScript/TypeScript files, such as CSS modules or JSON, are not
dependency edges.

The hosted GitHub importer accepts public repositories (up to 200 source files).
The source CLI can be used locally for larger repositories.

## REST API

Authenticate with an API key (create one in Settings) and call:

```bash
curl -X POST https://locus-five-iota.vercel.app/api/v1/locate \
  -H "Authorization: Bearer lk_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{"repo": "owner/repo", "task": "fix the login bug"}'
```

**Request body:**
- `repo` (string, required) — `owner/repo`, `owner/repo@ref`, or GitHub URL
- `task` (string, required) — natural language task description
- `evidence` (string, optional) — error logs, stack traces, etc.
- `budget` (number, optional) — max tokens for packed context (default: 40,000)

**Response:** JSON with `slice`, `anchors`, `tokens`, `graph`, packed `context`,
and `refinement` guidance when `widened` is `true`. `graph.sparse` warns when
few internal imports resolved and the reported token reduction may be overstated.

Rate limit: 30 requests/minute per user. Full reference at [/docs](https://locus-five-iota.vercel.app/docs).

## Run the web app

```bash
pnpm install
cp .env.example .env.local   # fill in your keys
pnpm dev
```

### Required environment variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk authentication |
| `CLERK_SECRET_KEY` | Clerk server-side auth |
| `ALPHA_ALLOWED_USER_IDS` | Comma-separated Clerk user IDs admitted to the `partner` Tier |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase persistence |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase browser client configuration |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role (server-side only) |
| `LOCUS_AGENT_MODEL` | Reviewed Vercel AI Gateway model identifier for Agent Runs |
| `CRON_SECRET` | Authorizes the daily retention job |
| `OPS_EXTERNAL_HEALTHCHECK` | Set to `github_actions` when the committed external production monitor is active |

### Optional environment variables

| Variable | Purpose |
|----------|---------|
| `LOCUS_SELF_SERVE` | Set to `open` to admit any signed-in account to the `free` Tier. Absent keeps the deployment invite-only |
| `GITHUB_TOKEN` | Higher GitHub API rate limits |
| `NEXT_PUBLIC_SITE_URL` | Public URL (auto-detected on Vercel) |
| `NEXT_PUBLIC_REPO_URL` | Source repo URL |
| `LOCUS_RUN_TOKEN_BUDGET` | Per-Run hard budget; safe default is 180,000 |
| `OPS_ALERT_WEBHOOK_URL` | HTTPS operational alert destination; takes precedence over the external health-check marker |

On Vercel, AI Gateway authentication uses the deployment's short-lived OIDC
credential automatically. Local development can use `AI_GATEWAY_API_KEY`; do
not add a direct model-provider key to the application.

### Admission and Tiers

Every signed-in account resolves to one **Tier**, and the Tier decides both what
the account may do and how many Agent Runs it may hold open.

| Tier | How it is reached | Runs (active / daily) | Public Repos | Private Repos | PR delivery | Billing |
|------|-------------------|----------------------|--------------|---------------|-------------|---------|
| `visitor` | Signed out, waitlisted, or suspended | 0 / 0 | read only | no | no | no |
| `free` | Any signed-in account while `LOCUS_SELF_SERVE=open` | 1 / 3 | yes | no | no | yes |
| `partner` | Listed in `ALPHA_ALLOWED_USER_IDS` | 2 / 10 | yes | yes | yes | comped |
| `pro` | Active Stripe subscription | 5 / 50 | yes | yes | yes | yes |

Several rules can match at once; the highest Tier wins, so a design partner who
later subscribes gains the paid Tier rather than keeping the comped one.

An operator row in `account_admissions` can raise an account above what these
rules give it, or refuse one outright by storing `visitor`. A stored refusal
beats every other rule, including an active subscription.

Capabilities are withheld separately by `CAPABILITY_RELEASE` in
[`src/lib/admission.ts`](src/lib/admission.ts). The table above is the ladder as
designed; the release record is what has actually shipped, and the two are
intersected. Opening self-serve therefore cannot release a capability by
accident: that is always a separate, reviewable commit.

### Authentication

Locus uses Clerk for account creation, email verification, and secure sessions.
Signed-out visitors see the public product site; signed-in users go to `/workspace`.

### Persistence

Supabase stores Agent Tasks, durable Runs, evidence, saved analyses, API keys, and
usage analytics.

For local development, use the committed Supabase CLI config:

```bash
pnpm dlx supabase@2.111.0 start
pnpm dlx supabase@2.111.0 db reset
pnpm dlx supabase@2.111.0 status
```

`db reset` replays the migration chain. Local ports and migration settings are
owned by [`supabase/config.toml`](supabase/config.toml); use `status` to copy the
local URL, anon key, and service-role key into `.env.local`.

For a linked or hosted database, apply migrations with the history-aware
procedure in
[`docs/operations/release-0-controlled-alpha-rollout.md`](docs/operations/release-0-controlled-alpha-rollout.md).
Do not apply migrations with an untracked shell loop.
Release 1 migrations `012`–`017` use the separate
[`Release 1 readiness rollout`](docs/operations/release-1-readiness-rollout.md).

### Export formats

Copy context in three formats:
- **Generic** — markdown with `===== file =====` separators
- **Claude** — XML-wrapped `<context>` blocks
- **Cursor** — `// File:` comment-style headers

## Develop the source CLI

The `locus-context` package is not published to npm. From this repository checkout:

```bash
node bin/locus.mjs locate "fix the dashboard billing" --pack
node bin/locus.mjs locate "login error" --evidence "TypeError: Cannot read property 'email'"
```

Options:
- `--pack` — emit the slice as a token-bounded paste block
- `--json` — machine-readable result with `dir`; file fields are relative to it
- `--evidence <text>` — error messages or stack traces to improve matching
- `--budget <n>` — token budget for `--pack` (default: 40,000)
- `--path <dir>` — repo directory (default: cwd)

## Develop the source MCP server

```bash
node bin/locus.mjs mcp
```

The server exposes `locate(task, path?, evidence?, pack?)`. Text responses name
the analyzed `Repo:` directory before file paths; those paths are relative to
that directory. The unpublished package source lives in [`cli/`](./cli);
`pnpm sync-cli` mirrors files from `bin/`.

## Verification

- **100+ automated tests**, including Run lifecycle, real CLI, and MCP stdio process tests
- GitHub CI runs lint, tests, CLI sync, type-checking, and a production build
- [`/api/health`](https://locus-five-iota.vercel.app/api/health) reports the
  deployed package version and Git revision
- The historical benchmark is generated from declared parent snapshots and fails
  its gate if fix-file recall drops below 100%. It runs locally via
  `pnpm benchmark`, **not** in CI, and `benchmarks/results.json` is a committed
  artifact from whenever it was last run, so unlike the checks above it is not
  enforced on every change

Run the same checks locally:

```bash
pnpm lint
pnpm test
pnpm exec tsc --noEmit
pnpm check-sync
pnpm evidence:release1
pnpm build
pnpm benchmark
```

The frozen paired total-token release gate is intentionally separate from the
historical localization benchmark. It fails closed until all 40 arm results are
recorded:

```bash
pnpm eval:release1
```

## Links

- [API Docs](https://locus-five-iota.vercel.app/docs)
- [Release 1 evidence](https://locus-five-iota.vercel.app/evidence/release-1)
- [Alpha access](https://locus-five-iota.vercel.app/pricing)
- [Privacy Policy](https://locus-five-iota.vercel.app/privacy)
- [Terms of Service](https://locus-five-iota.vercel.app/terms)
- [Benchmarks](./benchmarks/README.md)
- [Domain Language](./CONTEXT.md)

---

Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · Supabase · Clerk · Vitest · Vercel

MIT © Tarang Goyal

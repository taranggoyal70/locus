# Locus

**Review-ready engineering proposals with visible context evidence.**

Locus maps a natural-language task to a focused JavaScript/TypeScript code Slice:
matching files, their dependency closure, nearby integration points, and relevant
recent changes. When the evidence is weak, it returns the whole repo instead of a
speculative small slice and explains which terms were not found, possible starting
files, and repository language that can refine the task. During the invite-only
controlled alpha, the web product can run an Agent Task in an isolated Sandbox,
collect factual check evidence, and stop at a review-ready proposal. External
GitHub writes and billing are disabled. Active Runs survive refresh and can be
resumed, cancelled, and reviewed from the Runs ledger.

**Live:** https://locus-five-iota.vercel.app

## Current surfaces

| Surface | Use case |
|---------|----------|
| **Invite-only web alpha** | Localize, execute, run allowlisted checks, and review a proposal for a public Repo |
| **Experimental REST API** | Programmatic localization for public Repos |
| **Source runtimes** | CLI and MCP implementations used from a source checkout; no npm package is published |

## Evidence

The reproducible historical-task benchmark replays Locus on the parent snapshots
of 15 real fixes across Locus, Agent Access, and Solum:

- **100% historical fix-file recall** across all 15 declared cases
- **53% median estimated context reduction**
- **2 conservative whole-repo fallbacks**

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

**Response:** JSON with `slice`, `anchors`, `tokens`, packed `context`, and
`refinement` guidance when `widened` is `true`.

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
| `ALPHA_ALLOWED_USER_IDS` | Comma-separated Clerk user IDs allowed to start Agent Runs |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase persistence |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase browser client configuration |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role (server-side only) |
| `LOCUS_AGENT_MODEL` | Frozen provider/model identifier for Agent Runs |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Direct Google provider credential (server-side only) |
| `CRON_SECRET` | Authorizes the daily retention job |

### Optional environment variables

| Variable | Purpose |
|----------|---------|
| `GITHUB_TOKEN` | Higher GitHub API rate limits |
| `NEXT_PUBLIC_SITE_URL` | Public URL (auto-detected on Vercel) |
| `NEXT_PUBLIC_REPO_URL` | Source repo URL |
| `LOCUS_RUN_TOKEN_BUDGET` | Per-Run hard budget; safe default is 180,000 |
| `OPS_ALERT_WEBHOOK_URL` | HTTPS operational alert destination; required for Release 1 promotion |

### Authentication

Locus uses Clerk for account creation, email verification, and secure sessions.
Signed-out visitors see the public product site; signed-in users go to `/workspace`.

### Persistence

Supabase stores Agent Tasks, durable Runs, evidence, saved analyses, API keys, and
usage analytics. Apply every migration in order:

Use the history-aware procedure in
[`docs/operations/release-0-controlled-alpha-rollout.md`](docs/operations/release-0-controlled-alpha-rollout.md).
Do not apply migrations with an untracked shell loop.
Release 1 migrations `012`–`015` use the separate
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
- The historical benchmark is generated from declared parent snapshots and
  fails its launch gate if fix-file recall drops below 100%

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

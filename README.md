# Locus

**Verified engineering tasks with less context.**

Locus maps a natural-language task to a focused JavaScript/TypeScript code Slice:
matching files, their dependency closure, nearby integration points, and relevant
recent changes. When the evidence is weak, it returns the whole repo instead of a
speculative small slice and explains which terms were not found, possible starting
files, and repository language that can refine the task. The web product can then
run the Agent Task in an isolated Sandbox, collect verification evidence, and open
an approval-gated pull request. Active Runs survive refresh and remain reviewable
from the Runs ledger.

**Live:** https://locus-five-iota.vercel.app

## Four delivery surfaces

| Surface | Use case |
|---------|----------|
| **Web app** | Localize, execute, verify, review, and approve an Agent Task |
| **REST API** | Programmatic access for CI, agents, and custom tooling |
| **CLI** | `npx locus-context locate "fix billing" --pack` |
| **MCP server** | JSON-RPC over stdio for Claude, Cursor, and MCP-enabled agents |

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

## How it works

1. Parse `import`, `require()`, dynamic `import()`, and `@/` aliases into a deterministic dependency graph.
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

The hosted GitHub importer accepts public repositories (up to 200 source files).
Use the local CLI for larger repositories.

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

### Optional environment variables

| Variable | Purpose |
|----------|---------|
| `GITHUB_TOKEN` | Higher GitHub API rate limits |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase persistence |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role (server-side) |
| `NEXT_PUBLIC_SITE_URL` | Public URL (auto-detected on Vercel) |
| `NEXT_PUBLIC_REPO_URL` | Source repo URL |

### Authentication

Locus uses Clerk for account creation, email verification, and secure sessions.
Signed-out visitors see the public product site; signed-in users go to `/workspace`.

### Persistence

Supabase stores Agent Tasks, durable Runs, evidence, saved analyses, API keys, and
usage analytics. Apply every migration in order:

```bash
for migration in supabase/migrations/*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration"; done
```

### Export formats

Copy context in three formats:
- **Generic** — markdown with `===== file =====` separators
- **Claude** — XML-wrapped `<context>` blocks
- **Cursor** — `// File:` comment-style headers

## Use the CLI

```bash
npx -y locus-context locate "fix the dashboard billing" --pack
npx -y locus-context locate "login error" --evidence "TypeError: Cannot read property 'email'"
```

Options:
- `--pack` — emit the slice as a token-bounded paste block
- `--json` — machine-readable LocateResult
- `--evidence <text>` — error messages or stack traces to improve matching
- `--budget <n>` — token budget for `--pack` (default: 40,000)
- `--path <dir>` — repo directory (default: cwd)

## MCP server

```json
{
  "mcpServers": {
    "locus": {
      "command": "npx",
      "args": ["-y", "locus-context", "mcp"]
    }
  }
}
```

The server exposes `locate(task, path?, evidence?, pack?)`. The publishable
npm package lives in [`cli/`](./cli); `pnpm sync-cli` mirrors files from `bin/`.

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
pnpm build
pnpm benchmark
```

## Links

- [API Docs](https://locus-five-iota.vercel.app/docs)
- [Pricing](https://locus-five-iota.vercel.app/pricing)
- [Privacy Policy](https://locus-five-iota.vercel.app/privacy)
- [Terms of Service](https://locus-five-iota.vercel.app/terms)
- [Benchmarks](./benchmarks/README.md)
- [Domain Language](./CONTEXT.md)

---

Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · Supabase · Clerk · Vitest · Vercel

MIT © Tarang Goyal

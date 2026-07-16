# Locus

**Task-sized context for AI coding agents.**

Locus maps a natural-language task to a focused JavaScript/TypeScript code slice:
matching files, their dependency closure, nearby integration points, and relevant
recent changes. When the evidence is weak, it returns the whole repo instead of a
speculative small slice.

**Live:** https://locus-five-iota.vercel.app

## Four delivery surfaces

| Surface | Use case |
|---------|----------|
| **Web app** | Paste a public repo, describe a task, copy the context |
| **REST API** | Programmatic access for CI, agents, and custom tooling |
| **CLI** | `npx locus-context locate "fix billing" --pack` |
| **MCP server** | JSON-RPC over stdio for Claude, Cursor, and MCP-enabled agents |

## Evidence

The reproducible historical-task benchmark replays Locus on the parent snapshots
of nine real fixes across Locus, Agent Access, and Solum:

- **100% historical fix-file recall** across the nine declared cases
- **53% median estimated context reduction**
- **2 conservative whole-repo fallbacks**

See [the full method and every case](./benchmarks/README.md), or run:

```bash
npm run benchmark
```

## How it works

1. Parse `import`, `require()`, dynamic `import()`, and `@/` aliases into a deterministic dependency graph.
2. Match meaningful task words against file paths and source text.
3. Add dependency closures, direct consumers, and recent cross-cutting matches.
4. Widen to all loaded files when the evidence is insufficient.

### Task evidence

Attach screenshots, PDFs, DOCX files, or plain text to strengthen task matching.
Documents are processed in server memory and immediately discarded. Screenshot OCR
runs in the browser. Attachments are never written to storage.

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

**Response:** JSON with `slice`, `anchors`, `tokens`, and packed `context`.

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
Signed-out visitors go to login; signed-in users go to `/workspace`.

### Persistence

Supabase stores saved analyses, API keys, and usage analytics. Run the migration:

```bash
psql $DATABASE_URL < supabase/migrations/001_initial_schema.sql
```

### Export formats

Copy context in three formats:
- **Generic** — markdown with `===== file =====` separators
- **Claude** — XML-wrapped `<context>` blocks
- **Cursor** — `// File:` comment-style headers

## Use the CLI

```bash
npx locus-context locate "fix the dashboard billing" --pack
npx locus-context locate "login error" --evidence "TypeError: Cannot read property 'email'"
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
      "command": "node",
      "args": ["/absolute/path/to/locus/bin/mcp.mjs"]
    }
  }
}
```

The server exposes `locate(task, path?, evidence?, pack?)`. The publishable
npm package lives in [`cli/`](./cli); `npm run sync-cli` mirrors files from `bin/`.

## Validate

```bash
pnpm test
pnpm lint
pnpm check-sync
pnpm build
pnpm benchmark
```

## Links

- [API Docs](/docs)
- [Pricing](/pricing)
- [Privacy Policy](/privacy)
- [Terms of Service](/terms)
- [Benchmarks](./benchmarks/README.md)
- [Domain Language](./CONTEXT.md)

---

Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · Supabase · Clerk · Vitest · Vercel

MIT © Tarang Goyal

# ⊙ Locus

**Focused code context for AI coding agents.**

Locus maps a natural-language task to a focused TypeScript/Next.js code slice:
matching files, their dependency closure, nearby integration points, and relevant
recent changes. When the evidence is weak, it returns the whole repo instead of a
speculative small slice.

**Live:** https://locus-five-iota.vercel.app

## Evidence

The reproducible historical-task benchmark replays Locus on the parent snapshots
of nine real fixes across Locus, Agent Access, and Solum:

- **100% historical fix-file recall** across the nine declared cases
- **53% median estimated context reduction**
- **2 conservative whole-repo fallbacks**

This measures whether Locus includes the TypeScript files developers changed next.
It does not prove autonomous agent completion, guarantee that excluded files are
unnecessary, or promise unchanged quality. See [the full method and every
case](./benchmarks/README.md), or run:

```bash
npm run benchmark
```

## How it works

1. Parse relative and `@/` imports into a deterministic dependency graph.
2. Match meaningful task words against TypeScript paths and source text.
3. Add dependency closures, direct consumers, and recent cross-cutting matches.
4. Widen to all loaded files when the evidence is insufficient.

The current beta intentionally supports `.ts` and `.tsx` files. The hosted
GitHub importer accepts public repositories and caps each request at 120 supported
source files. Use the local CLI for larger repositories.

## Run the web app

```bash
pnpm install
pnpm dev
```

A `GITHUB_TOKEN` is optional for the hosted importer and increases GitHub API
rate limits.

### Accounts and protected workspace

Locus uses Clerk for real account creation, email verification, secure sessions,
profile management, and sign-out. The main URL is the account gateway: signed-out
visitors go to login and signed-in users go directly to `/workspace`. Product
access, repository analysis, and shared workspace views require authentication.

Create a free Clerk resource through the Vercel Marketplace, connect it to the
project, and provide these variables for local development:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
```

Authentication routes:

- `/` — route users to login or their workspace
- `/sign-up` — create an account
- `/sign-in` — return to an account
- `/workspace` — authenticated product workspace
- `/demo` — legacy route protected by authentication

## Use the CLI today

Until the npm release is available, run directly from GitHub:

```bash
npx github:taranggoyal70/locus locate "fix the dashboard billing" --pack
npx github:taranggoyal70/locus locate "fix the dashboard billing"
```

The CLI and MCP server have no runtime dependencies. `--pack` emits the selected
file contents as a token-bounded block.

## MCP server

From a clone:

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

The server exposes `locate(task, path?, pack?)`. The standalone publishable
package lives in [`cli/`](./cli); `npm run sync-cli` mirrors the executable
files from `bin/`.

## Validate

```bash
npm test
npm run lint
npm run build
npm run benchmark
```

Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · Vitest · Vercel

MIT © Tarang Goyal

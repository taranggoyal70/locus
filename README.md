# Locus

**Task-sized context for AI coding agents.**

Locus maps a natural-language task to a focused JavaScript/TypeScript code slice:
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

This measures whether Locus includes the files developers changed next.
It does not prove autonomous agent completion, guarantee that excluded files are
unnecessary, or promise unchanged quality. See [the full method and every
case](./benchmarks/README.md), or run:

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

## Run the web app

```bash
pnpm install
pnpm dev
```

A `GITHUB_TOKEN` is optional and increases GitHub API rate limits.

### Authentication

Locus uses Clerk for account creation, email verification, and secure sessions.
Signed-out visitors go to login; signed-in users go to `/workspace`.

Create a free Clerk resource through the Vercel Marketplace and provide:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...
```

### Export formats

Copy context in three formats:
- **Generic** — markdown with `===== file =====` separators
- **Claude** — XML-wrapped `<context>` blocks
- **Cursor** — `// File:` comment-style headers

## Use the CLI

```bash
npx github:taranggoyal70/locus locate "fix the dashboard billing" --pack
npx github:taranggoyal70/locus locate "login error" --evidence "TypeError: Cannot read property 'email'"
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

- [Privacy Policy](/privacy)
- [Terms of Service](/terms)
- [Benchmarks](./benchmarks/README.md)
- [Domain Language](./CONTEXT.md)

---

Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · Vitest · Vercel

MIT © Tarang Goyal

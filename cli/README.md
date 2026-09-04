# locus-context

**Show your coding agent only the code it needs.**

Your agent reads the whole repository to fix one bug. You pay for all of it, and
the signal it needs is buried in the noise it doesn't. `locus-context` maps a
task to the files that task actually touches — a dependency **Slice** — and tells
you exactly what it left out.

Zero dependencies. No account, no API key, no network call. It reads your
repository locally and prints.

```bash
npx -y locus-context locate "the stripe webhook processes events out of order"
```

```
Repo: /home/me/work/api  (paths below are relative to this directory)
Anchor: src/app/api/billing/webhook/route.ts, src/lib/supabase-tenant.ts

Slice (40 files):
  src/app/api/billing/webhook/route.ts   (dist 0, ~3048 tok)  [changed]
  src/lib/supabase-tenant.ts             (dist 1, ~1395 tok)
  ...

Excluded: 200 files
context: 75092/279278 tokens — 73% fewer
```

That is real output from a 240-file repository. Every path is relative to the
directory named on the first line, so you can open them.

## Paste it into an agent

```bash
npx -y locus-context locate "fix the checkout total" --pack | pbcopy
npx -y locus-context locate "login error" --evidence "TypeError: email is undefined"
npx -y locus-context locate "the retry logic" --json
```

`--pack` emits a token-bounded block ready to paste. `--budget` sets the ceiling
(default 40,000); an oversized first file is truncated to fit rather than
silently blowing past it.

## Use it as an MCP server

```json
{
  "mcpServers": {
    "locus": { "command": "npx", "args": ["-y", "locus-context", "mcp"] }
  }
}
```

Exposes one tool, `locate(task, path?, evidence?, pack?)`. Works with Claude
Code, Codex, Cursor, and anything else that speaks MCP.

## When the evidence is weak, it says so

This is the part most context tools get wrong. If no file anchors the task with
enough confidence, Locus **does not guess a small Slice** — it returns the whole
repository and tells you which of your words it could not find:

```
WIDENED to whole repo — no file matched with enough confidence
Unmatched task terms: checkout, refund
Refine with a filename, symbol, or repo term: requests, utils, adapters, auth
```

A wrong small Slice costs you a failed agent run. A conservative large one costs
you tokens. It picks the second, every time.

It also warns when few internal imports resolved, because a small Slice from a
sparse graph is an artifact rather than good localization — and the reported
saving is then overstated.

## Supported languages

| Language | Files | Import edges |
|---|---|---|
| TypeScript / JavaScript | `.ts` `.tsx` `.js` `.jsx` `.mjs` `.cjs` | `import`, `require()`, dynamic `import()`, `@/` aliases |
| Python | `.py` | `import a.b`, `from a.b import c`, relative `from .x` / `from ..y` |

Third-party packages are not edges in either ecosystem — only files that exist in
your repository. Route detection (`app/**/page.tsx`) is Next.js-specific; Python
files anchor on path and source instead, because Python routing lives in
decorators that would have to be guessed.

## What this does not claim

- The historical replay measures whether Locus includes the files developers
  changed next, on 15 fixes across 3 repositories the author owns. It is a
  regression suite, not independent evidence.
- It does not prove an agent completed the task, that every excluded file was
  unnecessary, or that agent quality cannot regress.
- Token counts are a character-based estimate, not a tokenizer.

## Options

```
locus locate "<task>" [--path .] [--json] [--pack] [--budget <n>] [--evidence <text>]
locus mcp
locus --help

--path <dir>       Repo directory to analyze (default: current directory)
--json             Machine-readable result, with the analyzed dir named
--pack             Token-bounded block ready to paste
--budget <n>       Token budget for --pack (default: 40,000)
--evidence <text>  Error message or stack trace, to improve matching
--                 End option parsing, for a task that begins with a dash
```

Invalid input fails loudly rather than guessing: an unknown flag, a
non-existent `--path`, or a malformed `--budget` all exit non-zero. The caller is
usually an agent, and an agent cannot notice that output looks wrong.

## MCP allowed roots

`locate` returns file contents, so the server only reads directories inside an
allowed root. The root defaults to the working directory the server started in,
which covers one editor open on one repository.

For a repository elsewhere, or several:

```json
{
  "mcpServers": {
    "locus": {
      "command": "npx",
      "args": ["-y", "locus-context", "mcp"],
      "env": { "LOCUS_MCP_ROOTS": "/home/me/work/api:/home/me/work/web" }
    }
  }
}
```

A `path` outside every allowed root is rejected rather than read. Roots are
compared after resolving symlinks, so a link inside a root cannot widen one.
MCP's own `roots` are advertised by the client and enforce nothing — this is a
server-side limit, so it holds even if the client is compromised.

Hosted version and the reproducible benchmark: https://locus-five-iota.vercel.app

MIT © Tarang Goyal

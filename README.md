# ⊙ Locus

**Show your AI coding agent only the code it needs.**

Every edit doesn't need the whole repo. Locus reads a codebase's real dependency
graph, and for a given task ("the dashboard chart is broken") returns the
**minimal relevant slice** — the entry point plus its transitive dependencies —
so an agent reads a fraction of the tokens instead of the whole tree.

Live demo: type a task and watch the irrelevant half of a codebase fade out while
a token counter drops.

## Why it works

In coding agents, **input tokens are the bulk of the cost** — reading files and
carrying context, re-sent every turn. Prompt caching helps *within* a warm
session, but every new task re-pays "understand the repo." Locus attacks that:
give the agent the dependency slice for the task, not the tree.

On the bundled StudentPulse demo (29 files, 5 feature areas), "fix the dashboard"
resolves to a **10-file slice — 67% fewer tokens**, excluding all the
analytics/reports/roster code entirely.

## The one rule that keeps quality safe

**Widen, never narrow.** If a task doesn't confidently match an entry point,
Locus falls back to the whole repo. Worst case = baseline, so quality can never
drop — only tokens. Cross-cutting bugs (a shared util that broke the dashboard)
are caught two ways: the shared file is already in the dependency slice, and a
recent-change signal floats it to the top.

## How it works

1. **Map the graph** — parse imports into a deterministic dependency graph
   (routes → components → hooks → libs). No LLM guessing.
2. **Localize** — match the task to an entry point, take its transitive
   dependency closure. That slice is what the agent needs.
3. **Rank** — by dependency distance, with recently-changed files surfaced first.

## Run it

```bash
pnpm install
pnpm dev   # or: next build && next start
```

Paste any public GitHub repo (`owner/name`) to localize tasks on real code; a
`GITHUB_TOKEN` is optional (higher rate limits).

## Use it on your repo

Zero-dependency CLI and MCP server, plain ESM — no build step, `node` v20+.

```bash
node bin/locus.mjs locate "fix the dashboard" --pack     # paste-ready context block
node bin/locus.mjs locate "fix the dashboard" --json     # machine LocateResult
node bin/locus.mjs locate "fix the dashboard"            # human summary + % saved
```

Or without cloning first: `npx github:taranggoyal70/locus locate "..." --pack`.

### As an MCP server (Codex / Claude Code / Cursor)

```bash
node bin/locus.mjs mcp        # or: node bin/mcp.mjs
```

Add to your MCP client config (`mcpServers`):

```json
{
  "mcpServers": {
    "locus": {
      "command": "node",
      "args": ["/path/to/locus/bin/mcp.mjs"]
    }
  }
}
```

The client's agent then calls the `locate` tool (`task`, optional `path`/`pack`)
before reading files, instead of grepping the whole repo.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS v4 · custom inline-SVG graph ·
deployed on Vercel. The localizer (`src/lib/localizer.ts`) is a pure, dependency-
free module — the natural next step is to expose `locate(task)` as an MCP tool so
Codex / Claude Code / Cursor call it before reading anything.

MIT © Tarang Goyal

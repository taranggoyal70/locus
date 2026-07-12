# locus-context

**Show your AI coding agent only the code it needs.** A zero-dependency CLI + MCP
server that localizes a task to the minimal dependency slice of a repo — fewer
input tokens, and it *widens* to the whole repo when unsure, so quality never drops.

Live demo & how it works: https://locus-five-iota.vercel.app

## CLI

```bash
npx -y locus-context locate "fix the dashboard" --pack   # paste-ready context
npx -y locus-context locate "fix the dashboard"          # summary + % saved
```

## MCP server (Codex / Claude Code / Cursor)

Add to your MCP client config so the agent pulls the slice before it reads:

```json
{
  "mcpServers": {
    "locus": { "command": "npx", "args": ["-y", "locus-context", "mcp"] }
  }
}
```

The agent then calls the `locate` tool (`task`, optional `path`, optional `pack`).

MIT © Tarang Goyal

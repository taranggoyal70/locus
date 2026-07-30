# locus-context

A zero-dependency CLI and MCP server that maps coding tasks to focused
JavaScript/TypeScript dependency slices. If task evidence is weak, Locus
conservatively returns the whole loaded repo.

Live demo and reproducible benchmark: https://locus-five-iota.vercel.app

## CLI

```bash
npx -y locus-context locate "fix the dashboard billing" --pack
npx -y locus-context locate "fix the dashboard billing"
npx -y locus-context locate "login error" --evidence "TypeError: email is undefined"
```

## MCP server

```json
{
  "mcpServers": {
    "locus": { "command": "npx", "args": ["-y", "locus-context", "mcp"] }
  }
}
```

The server exposes `locate(task, path?, evidence?, pack?, budget?)`. Current support
includes `.ts`, `.tsx`, `.js`, and `.jsx` files. Historical replay is evidence
about fix-file coverage, not a guarantee of autonomous agent completion or
unchanged quality.

MIT © Tarang Goyal

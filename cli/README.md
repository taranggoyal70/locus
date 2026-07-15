# locus-context

A zero-dependency CLI and MCP server that maps coding tasks to focused
TypeScript/Next.js dependency slices. If task evidence is weak, Locus
conservatively returns the whole loaded repo.

Live demo and reproducible benchmark: https://locus-five-iota.vercel.app

## CLI

```bash
npx -y locus-context locate "fix the dashboard billing" --pack
npx -y locus-context locate "fix the dashboard billing"
```

## MCP server

```json
{
  "mcpServers": {
    "locus": { "command": "npx", "args": ["-y", "locus-context", "mcp"] }
  }
}
```

The server exposes `locate(task, path?, pack?)`. Current support is limited to
`.ts` and `.tsx` files. Historical replay is evidence about fix-file coverage,
not a guarantee of autonomous agent completion or unchanged quality.

MIT © Tarang Goyal

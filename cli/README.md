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

The server exposes `locate(task, path?, evidence?, pack?)`. Current support
includes `.ts`, `.tsx`, `.js`, and `.jsx` files. Historical replay is evidence
about fix-file coverage, not a guarantee of autonomous agent completion or
unchanged quality.

When few internal imports resolve, CLI and MCP text output warns that the Slice
may be missing real dependencies and the token reduction may be overstated.

### Allowed roots

`locate` returns file contents, so the server only reads directories inside an
allowed root. The root defaults to the working directory the server was started
in, which covers the usual case of one editor open on one repository.

To serve a repository elsewhere, or several, set `LOCUS_MCP_ROOTS` to a
path-delimited list:

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
compared after resolving symlinks, so a link inside a root cannot widen it.
MCP's own `roots` are advertised by the client and enforce nothing — this is a
server-side limit, so it still holds if the client is compromised.

MIT © Tarang Goyal

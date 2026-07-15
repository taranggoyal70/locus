# LinkedIn launch post — Locus beta

I built Locus because I kept hitting the same wall with coding agents:

The product worked. The test cases made sense. But as the task grew, the agent kept reading more of the repo, the context window filled up, and the token budget disappeared.

So I asked a simple question:

**What if the agent saw the codebase through the task—not the whole tree?**

Locus maps a coding task to a focused TypeScript/Next.js context slice using:

- file-path and source evidence
- the import dependency graph
- nearby integration points
- recently changed files

If the evidence is weak, it widens to the whole repo instead of pretending a narrow answer is safe.

I also did not want to launch this with a vague “saves tokens without hurting quality” claim.

So I replayed 9 historical fixes across 3 real repositories.

On those declared cases, Locus:

- included all 12 files developers changed next
- reduced estimated context by a 53% median
- widened to the whole repo on 2 ambiguous tasks

That is **historical fix-file recall**, not proof that an autonomous agent will always finish the task. The benchmark, cases, and failures are open for anyone to inspect.

Locus is now an open-source beta with a browser workflow, zero-dependency CLI, and MCP server.

I’m looking for **10 TypeScript/Next.js developers who use Codex, Claude Code, Cursor, or another coding agent to become founding design partners**.

Try it on one real task. Then tell me where it misses.

Live: https://locus-five-iota.vercel.app
GitHub: https://github.com/taranggoyal70/locus

#opensource #typescript #nextjs #aiagents #buildinpublic

## First comment

If you test it, send me:

1. the task you gave your agent,
2. the files Locus selected,
3. whether the missing context—if any—was obvious.

I care more about the failure cases than a flattering demo.

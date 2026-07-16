import { SITE_URL } from "@/lib/config";
import Image from "next/image";
import Link from "next/link";

export default function DocsPage() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-ink/[0.88] backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-3.5 sm:px-8">
          <Link href="/" className="flex items-center gap-3 text-paper">
            <Image src="/locus-mark.svg" width={28} height={28} alt="" priority />
            <span className="font-semibold tracking-[-0.02em]">Locus</span>
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/workspace" className="rounded-lg px-3 py-2 text-muted-light transition hover:text-paper">
              Workspace
            </Link>
            <Link href="/docs" className="rounded-lg px-3 py-2 text-accent font-medium">
              Docs
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-12 sm:px-8">
        <h1 className="text-3xl font-semibold tracking-[-0.04em] text-paper">API Reference</h1>
        <p className="mt-3 text-sm leading-6 text-muted-light">
          Use the Locus API to get task-sized context from any public GitHub repository. Authenticate with an API key from your <Link href="/settings" className="text-accent hover:underline">settings page</Link>.
        </p>

        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-paper">Authentication</h2>
          <p className="mt-2 text-sm leading-6 text-muted-light">
            All API requests require a Bearer token. Generate keys in <Link href="/settings" className="text-accent hover:underline">Settings</Link>.
          </p>
          <pre className="mt-3 overflow-x-auto rounded-xl border border-line-strong bg-surface p-4 font-mono text-xs leading-5 text-muted-light">
{`Authorization: Bearer lk_your_key_here`}
          </pre>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-paper">POST /api/v1/locate</h2>
          <p className="mt-2 text-sm leading-6 text-muted-light">
            Analyze a repository for a given task and return the focused file slice with packed context.
          </p>

          <h3 className="mt-6 text-sm font-semibold text-paper">Request body</h3>
          <div className="mt-2 overflow-hidden rounded-xl border border-line-strong">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface/50">
                  <th className="px-4 py-2 text-left font-medium text-paper">Field</th>
                  <th className="px-4 py-2 text-left font-medium text-paper">Type</th>
                  <th className="px-4 py-2 text-left font-medium text-paper">Required</th>
                  <th className="px-4 py-2 text-left font-medium text-paper">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-muted-light">
                <tr>
                  <td className="px-4 py-2 font-mono text-xs text-paper">repo</td>
                  <td className="px-4 py-2">string</td>
                  <td className="px-4 py-2">Yes</td>
                  <td className="px-4 py-2">GitHub repo as <code className="text-accent">owner/repo</code>, <code className="text-accent">owner/repo@ref</code>, or a full GitHub URL</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-mono text-xs text-paper">task</td>
                  <td className="px-4 py-2">string</td>
                  <td className="px-4 py-2">Yes</td>
                  <td className="px-4 py-2">Natural language description of the engineering task</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-mono text-xs text-paper">evidence</td>
                  <td className="px-4 py-2">string</td>
                  <td className="px-4 py-2">No</td>
                  <td className="px-4 py-2">Additional context (error logs, screenshots text, etc.)</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-mono text-xs text-paper">budget</td>
                  <td className="px-4 py-2">number</td>
                  <td className="px-4 py-2">No</td>
                  <td className="px-4 py-2">Max tokens for the packed context (default: 40,000)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="mt-6 text-sm font-semibold text-paper">Example request</h3>
          <pre className="mt-2 overflow-x-auto rounded-xl border border-line-strong bg-surface p-4 font-mono text-xs leading-5 text-muted-light">
{`curl -X POST ${SITE_URL}/api/v1/locate \\
  -H "Authorization: Bearer lk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "repo": "vercel/next.js",
    "task": "fix the middleware redirect loop"
  }'`}
          </pre>

          <h3 className="mt-6 text-sm font-semibold text-paper">Response</h3>
          <pre className="mt-2 overflow-x-auto rounded-xl border border-line-strong bg-surface p-4 font-mono text-xs leading-5 text-muted-light">
{`{
  "task": "fix the middleware redirect loop",
  "widened": false,
  "reason": "Strong anchor match on middleware files",
  "anchors": ["middleware.ts"],
  "slice": [
    { "path": "middleware.ts", "tokens": 450, "distance": 0, "recent": true },
    { "path": "lib/auth.ts", "tokens": 320, "distance": 1, "recent": false }
  ],
  "excluded": ["components/Header.tsx", "..."],
  "tokens": {
    "slice": 770,
    "total": 45000,
    "savedPct": 98
  },
  "context": "===== middleware.ts =====\\n..."
}`}
          </pre>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-paper">Rate limits</h2>
          <p className="mt-2 text-sm leading-6 text-muted-light">
            API requests are limited to 30 per minute per user. Exceeding the limit returns <code className="text-accent">429 Too Many Requests</code> with a <code className="text-accent">Retry-After</code> header.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-paper">Error codes</h2>
          <div className="mt-2 overflow-hidden rounded-xl border border-line-strong">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface/50">
                  <th className="px-4 py-2 text-left font-medium text-paper">Status</th>
                  <th className="px-4 py-2 text-left font-medium text-paper">Meaning</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-muted-light">
                <tr><td className="px-4 py-2 font-mono text-xs">400</td><td className="px-4 py-2">Bad request — missing or invalid fields</td></tr>
                <tr><td className="px-4 py-2 font-mono text-xs">401</td><td className="px-4 py-2">Invalid or missing API key</td></tr>
                <tr><td className="px-4 py-2 font-mono text-xs">422</td><td className="px-4 py-2">Analysis failed — repo not found, no source files, etc.</td></tr>
                <tr><td className="px-4 py-2 font-mono text-xs">429</td><td className="px-4 py-2">Rate limit exceeded</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-paper">Other interfaces</h2>
          <p className="mt-2 text-sm leading-6 text-muted-light">
            Beyond the HTTP API, Locus also ships as:
          </p>
          <ul className="mt-3 space-y-2 text-sm text-muted-light">
            <li><strong className="text-paper">CLI</strong> — <code className="text-accent">npx locus-context locate &quot;your task&quot; --pack</code></li>
            <li><strong className="text-paper">MCP server</strong> — JSON-RPC over stdio, compatible with Claude, Cursor, and other MCP-enabled agents</li>
          </ul>
        </section>
      </main>
    </div>
  );
}

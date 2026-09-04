import type { Metadata } from "next";

import { MarketingShell } from "@/components/MarketingShell";
import { selfServeOpen } from "@/lib/admission";
import { SITE_URL } from "@/lib/config";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Experimental API Reference — Locus",
  description: "Use the experimental Locus API to localize public JavaScript, TypeScript, and Python repositories.",
};

export default function DocsPage() {
  return (
    <MarketingShell selfServeOpen={selfServeOpen()}>
      <main className="mx-auto max-w-4xl px-5 py-12 sm:px-8">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-accent">Experimental localization API</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.05em] text-paper sm:text-5xl">Localize before you spend.</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-light">
          Invite-only Agent Runs localize a public Repo, work in an isolated Sandbox, run
          allowlisted checks, and stop at a review-ready proposal. The API below exposes only the
          deterministic localization engine for experimental use. Authenticate with an API key
          from your <Link href="/settings" className="text-accent hover:underline">settings page</Link>.
        </p>

        <div className="aperture-rule mt-8" />

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
          <div className="mt-2 overflow-x-auto rounded-xl border border-line-strong">
            <table className="min-w-[680px] text-sm">
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
                  <td className="px-4 py-2">Max tokens for the packed context (default: 40,000, capped at 200,000)</td>
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
  "refinement": null,
  "anchors": ["middleware.ts"],
  "slice": [
    { "path": "middleware.ts", "tokens": 450, "distance": 0, "recent": true },
    { "path": "lib/auth.ts", "tokens": 320, "distance": 1, "recent": false }
  ],
  "excluded": ["components/Header.tsx", "..."],
  "graph": {
    "edgeDensity": 1.25,
    "sparse": false
  },
  "coverage": {
    "matchedFiles": 62,
    "analyzedFiles": 62,
    "truncated": false,
    "limit": 200
  },
  "tokens": {
    "included": 770,
    "total": 45000
  },
  "context": "===== middleware.ts =====\\n..."
}`}
          </pre>
          <p className="mt-3 text-sm leading-6 text-muted-light">
            Every path in the response is relative to the repository root, so it opens directly in a
            checkout of <code className="text-accent">repo</code>. That applies to
            <code className="text-accent"> anchors</code>, <code className="text-accent">excluded</code>,
            each <code className="text-accent">slice[].path</code>, the file headers inside
            <code className="text-accent"> context</code>, and the starting files in
            <code className="text-accent"> refinement</code>. A repository whose source lives under a
            prefix such as <code className="text-accent">src/</code> keeps that prefix.
          </p>
          <p className="mt-3 text-sm leading-6 text-muted-light">
            When <code className="text-accent">widened</code> is true, the full Repo is retained and
            <code className="text-accent"> refinement</code> contains unmatched task terms, possible
            starting files, and repository terms the caller can use to make the task more specific.
          </p>
          <p className="mt-3 text-sm leading-6 text-muted-light">
            When <code className="text-accent">graph.sparse</code> is true on a non-widened response,
            few internal imports resolved. The response still includes the best Slice, but the packed
            <code className="text-accent"> context</code> starts with a warning because the token
            reduction may be an unresolved-import artifact.
          </p>
          <p className="mt-3 text-sm leading-6 text-muted-light">
            When <code className="text-accent">coverage.truncated</code> is true, the repository had
            more supported source files than the API analyzes in one request, so
            <code className="text-accent"> analyzedFiles</code> is below
            <code className="text-accent"> matchedFiles</code>. Everything else in the response then
            describes the analyzed portion only: <code className="text-accent">excluded</code> omits
            files that were never fetched, and <code className="text-accent">tokens.total</code> is the
            analyzed total the reduction is measured against. Analyze a large repository with the
            source CLI, which has no file cap.
          </p>
          <p className="mt-3 rounded-xl border border-line-strong bg-surface px-4 py-3 text-sm leading-6 text-muted-light">
            Token counts report only the context included by this localization response and the
            repository total measured by the same estimator. They do not claim whole-Run savings,
            task completion, or correctness.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-paper">Rate limits</h2>
          <p className="mt-2 text-sm leading-6 text-muted-light">
            API requests are limited to 30 per minute per user. Exceeding the limit returns <code className="text-accent">429 Too Many Requests</code> with a <code className="text-accent">Retry-After</code> header.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-paper">Error codes</h2>
          <div className="mt-2 overflow-x-auto rounded-xl border border-line-strong">
            <table className="min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-line bg-surface/50">
                  <th className="px-4 py-2 text-left font-medium text-paper">Status</th>
                  <th className="px-4 py-2 text-left font-medium text-paper">Meaning</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-muted-light">
                <tr><td className="px-4 py-2 font-mono text-xs">400</td><td className="px-4 py-2">Bad request — missing or invalid fields</td></tr>
                <tr><td className="px-4 py-2 font-mono text-xs">401</td><td className="px-4 py-2">Invalid or missing API key</td></tr>
                <tr><td className="px-4 py-2 font-mono text-xs">403</td><td className="px-4 py-2">Repository is not public - this API supports public repositories only</td></tr>
                <tr><td className="px-4 py-2 font-mono text-xs">422</td><td className="px-4 py-2">Analysis failed — repo not found, no source files, etc.</td></tr>
                <tr><td className="px-4 py-2 font-mono text-xs">429</td><td className="px-4 py-2">Rate limit exceeded</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-paper">Source runtimes</h2>
          <p className="mt-2 text-sm leading-6 text-muted-light">
            CLI and MCP implementations exist in the open-source repository for development and
            automated testing. The <code className="text-accent">locus-context</code> package is not
            published to npm, so no package-manager installation is currently advertised or supported.
          </p>
        </section>
      </main>
    </MarketingShell>
  );
}

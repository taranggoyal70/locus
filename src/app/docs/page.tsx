import type { Metadata } from "next";

import { MarketingShell } from "@/components/MarketingShell";
import { selfServeOpen } from "@/lib/admission";
import { SITE_URL } from "@/lib/config";
import Link from "next/link";
import { frame, Rule } from "@/components/Datasheet";
import { monoLabel, PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "Experimental API Reference · Locus",
  description: "Use the experimental Locus API to localize public JavaScript, TypeScript, and Python repositories.",
};

const SECTIONS = [
  ["authentication", "Authentication"],
  ["locate", "POST /api/v1/locate"],
  ["rate-limits", "Rate limits"],
  ["errors", "Error codes"],
  ["runtimes", "Source runtimes"],
] as const;

export default function DocsPage() {
  return (
    <MarketingShell selfServeOpen={selfServeOpen()}>
      <main>
        <PageHeader label="Experimental localization API" title="Localize before" subtitle="you spend.">
          Invite-only Agent Runs localize a public Repo, work in an isolated Sandbox, run
          allowlisted checks, and stop at a review-ready proposal. The API below exposes only the
          deterministic localization engine for experimental use. Authenticate with an API key
          from your <Link href="/settings" className="doc-link">settings page</Link>.
        </PageHeader>

        <Rule />

        <div className={`${frame} grid gap-12 py-14 sm:py-20 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10`}>
          <nav aria-label="On this page" className="hidden lg:block">
            <div className="sticky top-24">
              <p className={monoLabel}>On this page</p>
              <ol className="mt-4 border-t border-line-2">
                {SECTIONS.map(([id, title], index) => (
                  <li key={id}>
                    <a href={`#${id}`} className="flex items-baseline gap-3 border-b border-line py-2.5 text-[14px] text-ink-2 transition-colors duration-150 hover:text-ink">
                      <span className="font-mono text-[11px] text-muted tabular-nums">0{index + 1}</span>
                      {title}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </nav>
          <div className="doc min-w-0 max-w-[780px]">
        <section id="authentication" className="doc-section">
          <p className={monoLabel}>01</p>
          <h2 className="mt-3 font-display text-[clamp(28px,3vw,38px)] font-normal leading-[1.08] tracking-[-0.02em] text-ink">Authentication</h2>
          <p className="mt-4">
            All API requests require a Bearer token. Generate keys in <Link href="/settings" className="doc-link">Settings</Link>.
          </p>
          <pre className="doc-code mt-4" tabIndex={0}>
{`Authorization: Bearer lk_your_key_here`}
          </pre>
        </section>

        <section id="locate" className="doc-section">
          <p className={monoLabel}>02</p>
          <h2 className="mt-3 font-display text-[clamp(28px,3vw,38px)] font-normal leading-[1.08] tracking-[-0.02em] text-ink">POST /api/v1/locate</h2>
          <p className="mt-4">
            Analyze a repository for a given task and return the focused file slice with packed context.
          </p>

          <h3>Request body</h3>
          <div className="doc-table" role="region" aria-label="Request body" tabIndex={0}>
            <table className="min-w-[640px]">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Type</th>
                  <th>Required</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>repo</td>
                  <td>string</td>
                  <td>Yes</td>
                  <td>GitHub repo as <code>owner/repo</code>, <code>owner/repo@ref</code>, or a full GitHub URL</td>
                </tr>
                <tr>
                  <td>task</td>
                  <td>string</td>
                  <td>Yes</td>
                  <td>Natural language description of the engineering task</td>
                </tr>
                <tr>
                  <td>evidence</td>
                  <td>string</td>
                  <td>No</td>
                  <td>Additional context (error logs, screenshots text, etc.)</td>
                </tr>
                <tr>
                  <td>budget</td>
                  <td>number</td>
                  <td>No</td>
                  <td>Max tokens for the packed context (default: 40,000, capped at 200,000)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3>Example request</h3>
          <pre className="doc-code mt-4" tabIndex={0}>
{`curl -X POST ${SITE_URL}/api/v1/locate \\
  -H "Authorization: Bearer lk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "repo": "vercel/next.js",
    "task": "fix the middleware redirect loop"
  }'`}
          </pre>

          <h3>Response</h3>
          <pre className="doc-code mt-4" tabIndex={0}>
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
          <p className="mt-4">
            Every path in the response is relative to the repository root, so it opens directly in a
            checkout of <code>repo</code>. That applies to
            <code> anchors</code>, <code>excluded</code>,
            each <code>slice[].path</code>, the file headers inside
            <code> context</code>, and the starting files in
            <code> refinement</code>. A repository whose source lives under a
            prefix such as <code>src/</code> keeps that prefix.
          </p>
          <p className="mt-4">
            When <code>widened</code> is true, the full Repo is retained and
            <code> refinement</code> contains unmatched task terms, possible
            starting files, and repository terms the caller can use to make the task more specific.
          </p>
          <p className="mt-4">
            When <code>graph.sparse</code> is true on a non-widened response,
            few internal imports resolved. The response still includes the best Slice, but the packed
            <code> context</code> starts with a warning because the token
            reduction may be an unresolved-import artifact.
          </p>
          <p className="mt-4">
            When <code>coverage.truncated</code> is true, the repository had
            more supported source files than the API analyzes in one request, so
            <code> analyzedFiles</code> is below
            <code> matchedFiles</code>. Everything else in the response then
            describes the analyzed portion only: <code>excluded</code> omits
            files that were never fetched, and <code>tokens.total</code> is the
            analyzed total the reduction is measured against. Analyze a large repository with the
            source CLI, which has no file cap.
          </p>
          <p className="doc-note">
            Token counts report only the context included by this localization response and the
            repository total measured by the same estimator. They do not claim whole-Run savings,
            task completion, or correctness.
          </p>
        </section>

        <section id="rate-limits" className="doc-section">
          <p className={monoLabel}>03</p>
          <h2 className="mt-3 font-display text-[clamp(28px,3vw,38px)] font-normal leading-[1.08] tracking-[-0.02em] text-ink">Rate limits</h2>
          <p className="mt-4">
            API requests are limited to 30 per minute per user. Exceeding the limit returns <code>429 Too Many Requests</code> with a <code>Retry-After</code> header.
          </p>
        </section>

        <section id="errors" className="doc-section">
          <p className={monoLabel}>04</p>
          <h2 className="mt-3 font-display text-[clamp(28px,3vw,38px)] font-normal leading-[1.08] tracking-[-0.02em] text-ink">Error codes</h2>
          <div className="doc-table" role="region" aria-label="Error codes" tabIndex={0}>
            <table className="min-w-[420px]">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Meaning</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>400</td><td>Bad request: missing or invalid fields</td></tr>
                <tr><td>401</td><td>Invalid or missing API key</td></tr>
                <tr><td>403</td><td>Repository is not public - this API supports public repositories only</td></tr>
                <tr><td>422</td><td>Analysis failed: repo not found, no source files, etc.</td></tr>
                <tr><td>429</td><td>Rate limit exceeded</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section id="runtimes" className="doc-section">
          <p className={monoLabel}>05</p>
          <h2 className="mt-3 font-display text-[clamp(28px,3vw,38px)] font-normal leading-[1.08] tracking-[-0.02em] text-ink">Source runtimes</h2>
          <p className="mt-4">
            CLI and MCP implementations exist in the open-source repository for development and
            automated testing. The <code>locus-context</code> package is not
            published to npm, so no package-manager installation is currently advertised or supported.
          </p>
        </section>
          </div>
        </div>
      </main>
    </MarketingShell>
  );
}

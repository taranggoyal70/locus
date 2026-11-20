import type { Metadata } from "next";
import Link from "next/link";

import { MarketingShell } from "@/components/MarketingShell";
import { selfServeOpen } from "@/lib/admission";
import { SITE_URL } from "@/lib/config";
import { frame, Rule } from "@/components/Datasheet";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "Terms of Service · Locus",
  description: "Terms governing use of Locus.",
};

export default function TermsPage() {
  return (
    <MarketingShell selfServeOpen={selfServeOpen()}>
      <main>
        <PageHeader label="Terms" title="Terms of Service">
          <p className="font-mono text-[12px] uppercase tracking-[0.08em] text-muted">Effective August 30, 2026</p>
          <p className="mt-3">Terms for Locus public early access.</p>
        </PageHeader>

        <Rule />

        <div className={`${frame} grid gap-6 py-14 sm:py-20 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10`}>
          <p aria-hidden="true" className="hidden font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted lg:block">Terms</p>
        <div className="doc legal max-w-[720px]">
          <section>
            <h2>Service</h2>
            <p>
              Locus is an experimental, open-source agent workspace operated by Tarang Goyal. It
              localizes tasks for public JavaScript, TypeScript, and Python repositories for every signed-in
              user. During the limited free beta, signed-in users can request a shared Agent Run or
              connect their own Cloudflare Workers AI account, continue in an isolated Sandbox,
              record allowlisted Check results, and inspect a proposal for human Review. Shared
              capacity is limited and may be unavailable until its next UTC reset. External repository
              writes and Locus billing are disabled during early access.
              The hosted version at {new URL(SITE_URL).hostname} is provided as-is, without warranty.
            </p>
          </section>

          <section>
            <h2>Acceptable use</h2>
            <p>
              You may use Locus for any lawful purpose. Do not use the service to circumvent
              GitHub&apos;s terms of service, abuse rate limits, or analyze repositories you do not
              have permission to access. Automated bulk analysis via the hosted API is not permitted
              without prior arrangement.
            </p>
          </section>

          <section>
            <h2>Accounts</h2>
            <p>
              Authentication is handled by Clerk. You are responsible for maintaining the security
              of your account credentials and any provider token you connect. You authorize Locus to
              use a connected token only for Agent Runs you request. We may suspend accounts that
              violate these terms or abuse the service.
            </p>
          </section>

          <section>
            <h2>Data handling</h2>
            <p>
              Repository source is processed by Locus and its execution providers. Durable task,
              run, evidence, and approval records are stored for product operation. See our{" "}
              <Link href="/privacy" className="doc-link">Privacy Policy</Link>{" "}
              for complete details on data handling.
            </p>
          </section>

          <section>
            <h2>Agent output</h2>
            <p>
              Generated code, commands, summaries, and Check evidence may be incomplete, unsafe, or
              incorrect. A successful command does not prove that acceptance criteria are satisfied.
              You are responsible for reviewing, testing, and safely applying any proposed change.
            </p>
          </section>

          <section>
            <h2>Limitation of liability</h2>
            <p>
              Locus is provided &ldquo;as is&rdquo; without warranties of any kind. We are not
              liable for any damages arising from the use or inability to use the service,
                including but not limited to inaccurate analysis, generated code, or agent actions.
            </p>
          </section>

          <section>
            <h2>Open source</h2>
            <p>
              Locus is licensed under the MIT License. You may self-host, modify, and distribute
              the software in accordance with the license terms. CLI and MCP source runtimes can be
              executed from a repository checkout; no npm distribution is currently published.
            </p>
          </section>

          <section>
            <h2>Changes</h2>
            <p>
              We may update these terms as the service evolves. Questions and early-access support requests
              can be submitted through the{" "}
              <a
                href="https://github.com/taranggoyal70/locus/issues/new"
                className="doc-link"
              >
                Locus issue tracker
              </a>.
            </p>
          </section>
        </div>
        </div>
      </main>
    </MarketingShell>
  );
}

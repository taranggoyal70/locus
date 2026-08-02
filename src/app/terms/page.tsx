import type { Metadata } from "next";
import Link from "next/link";

import { MarketingShell } from "@/components/MarketingShell";
import { SITE_URL } from "@/lib/config";

export const metadata: Metadata = {
  title: "Terms of Service — Locus",
  description: "Terms governing use of Locus.",
};

export default function TermsPage() {
  return (
    <MarketingShell>
      <main className="mx-auto max-w-3xl px-5 py-12">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-accent">Terms</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.05em] text-paper">Terms of Service</h1>
        <p className="mt-3 text-sm leading-7 text-muted-light">The ground rules for using the Locus public beta.</p>
        <div className="aperture-rule mt-8" />

        <div className="mt-8 space-y-6 text-sm leading-7 text-muted-light">
          <section>
            <h2 className="text-lg font-semibold text-paper">Service</h2>
            <p>
              Locus is an open-source agent workspace that localizes coding tasks, generates
              changes in a sandbox, runs verification, and presents the result for approval. It is
              provided as-is, without warranty. The hosted version at{" "}
              {new URL(SITE_URL).hostname} is a convenience deployment of the open-source project.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-paper">Acceptable use</h2>
            <p>
              You may use Locus for any lawful purpose. Do not use the service to circumvent
              GitHub&apos;s terms of service, abuse rate limits, or analyze repositories you do not
              have permission to access. Automated bulk analysis via the hosted API is not permitted
              without prior arrangement.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-paper">Accounts</h2>
            <p>
              Authentication is handled by Clerk. You are responsible for maintaining the security
              of your account credentials. We may suspend accounts that violate these terms or
              abuse the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-paper">Data handling</h2>
            <p>
              Repository source is processed by Locus and its execution providers. Durable task,
              run, evidence, and approval records are stored for product operation. See our{" "}
              <Link href="/privacy" className="text-accent hover:underline">Privacy Policy</Link>{" "}
              for complete details on data handling.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-paper">Agent output</h2>
            <p>
              Generated code, commands, summaries, and verification results may be incomplete or
              incorrect. You are responsible for reviewing a proposed change before approving,
              merging, deploying, or otherwise relying on it. Approval gates reduce risk but do not
              replace your judgment or testing requirements.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-paper">Limitation of liability</h2>
            <p>
              Locus is provided &ldquo;as is&rdquo; without warranties of any kind. We are not
              liable for any damages arising from the use or inability to use the service,
                including but not limited to inaccurate analysis, generated code, or agent actions.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-paper">Open source</h2>
            <p>
              Locus is licensed under the MIT License. You may self-host, modify, and distribute
              the software in accordance with the license terms. The CLI and MCP server operate
              entirely locally and do not require an account.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-paper">Changes</h2>
            <p>
              We may update these terms as the service evolves.
            </p>
          </section>
        </div>
      </main>
    </MarketingShell>
  );
}

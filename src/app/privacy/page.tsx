import type { Metadata } from "next";

import { MarketingShell } from "@/components/MarketingShell";
import { REPO_URL } from "@/lib/config";

export const metadata: Metadata = {
  title: "Privacy Policy — Locus",
  description: "How Locus handles your data.",
};

export default function PrivacyPage() {
  return (
    <MarketingShell>
      <main className="mx-auto max-w-3xl px-5 py-12">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-accent">Trust</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.05em] text-paper">Privacy Policy</h1>
        <p className="mt-3 text-sm leading-7 text-muted-light">What Locus processes, what it keeps, and why.</p>
        <div className="aperture-rule mt-8" />

        <div className="mt-8 space-y-6 text-sm leading-7 text-muted-light">
          <section>
            <h2 className="text-lg font-semibold text-paper">What we collect</h2>
            <p>
              Locus uses Clerk for authentication. When you create an account, Clerk stores your
              email address and authentication credentials on their infrastructure. We do not store
              passwords or payment information.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-paper">Repository data</h2>
            <p>
              When you analyze a repository or start an Agent Run, source code is fetched from
              GitHub and processed by Locus and its execution sandbox. Locus does not intentionally
              retain a complete copy of your repository. If you connect GitHub, the access token is
              stored server-side so Locus can access repositories you authorize.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-paper">Run records</h2>
            <p>
              To make Agent Runs durable and auditable, Locus stores task metadata, included and
              excluded file paths, run steps and status, generated change sets, verification
              evidence, approval events, and token-usage measurements in Supabase. These records
              are associated with your account and support run history, resume, and review.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-paper">Task evidence</h2>
            <p>
              Screenshots, PDFs, and documents you upload for task evidence are processed
              server-side for text extraction. Uploaded binaries are not intentionally retained;
              extracted text may become part of the task or run record when you submit it.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-paper">Analytics</h2>
            <p>
              Hosting, authentication, database, and execution providers process operational data
              required to run the service. Server logs may include request metadata such as an IP
              address, timestamp, user agent, route, and error details for security, reliability,
              and rate limiting. We do not sell personal data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-paper">Contact</h2>
            <p>
              Questions about this policy? Open an issue on{" "}
              <a href={REPO_URL} className="text-accent hover:underline">
                GitHub
              </a>.
            </p>
          </section>
        </div>
      </main>
    </MarketingShell>
  );
}

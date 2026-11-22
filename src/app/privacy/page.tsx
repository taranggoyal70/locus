import type { Metadata } from "next";

import { MarketingShell } from "@/components/MarketingShell";
import { selfServeOpen } from "@/lib/admission";
import { SUPPORT_URL } from "@/lib/config";
import { frame, Rule } from "@/components/Datasheet";
import { PageHeader } from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "Privacy Policy · Locus",
  description: "How Locus handles your data.",
};

export default function PrivacyPage() {
  return (
    <MarketingShell selfServeOpen={selfServeOpen()}>
      <main>
        <PageHeader label="Trust" title="Privacy Policy">
          <p className="font-mono text-[12px] uppercase tracking-[0.08em] text-muted">Effective August 30, 2026</p>
          <p className="mt-3">What Locus processes, keeps, and shares.</p>
        </PageHeader>

        <Rule />

        <div className={`${frame} grid gap-6 py-14 sm:py-20 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10`}>
          <p aria-hidden="true" className="hidden font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted lg:block">Privacy</p>
        <div className="doc legal max-w-[720px]">
          <section>
            <h2>What we collect</h2>
            <p>
              Locus uses Clerk for authentication. When you create an account, Clerk stores your
              email address and authentication credentials on their infrastructure. We do not store
              passwords or payment information.
            </p>
          </section>

          <section>
            <h2>Repository data</h2>
            <p>
              Hosted early access supports public repositories only. Source is fetched from GitHub and
              processed by Locus, the configured model provider, and its execution Sandbox. Locus
              does not intentionally retain a complete repository copy after execution, but generated
              diffs and source excerpts can appear in durable Run records. New GitHub OAuth
              connections are disabled during early access.
            </p>
          </section>

          <section>
            <h2>Durable Run records</h2>
            <p>
              To make Agent Runs durable and auditable, Locus stores task metadata, included and
              excluded file paths, Run Steps and status, generated change sets, Check evidence,
              review events, and token-usage measurements in Neon. These records
              are associated with your account and support run history, resume, and review.
            </p>
          </section>

          <section>
            <h2>Task evidence</h2>
            <p>
              Screenshots, PDFs, and documents you upload for task evidence are processed
              server-side for text extraction. Uploaded binaries are not intentionally retained;
              extracted text may become part of the task or run record when you submit it.
            </p>
          </section>

          <section>
            <h2>Providers and operational data</h2>
            <p>
              Clerk, Neon, GitHub, and Vercel process data needed for authentication, persistence,
              repository intake, hosting, workflow execution, and Sandbox operation. Cloudflare Workers
              AI processes task instructions, admitted source, and tool results. Cloudflare states that
              Workers AI customer content is not used for model training without explicit consent. Server
              logs may include IP address, timestamp, user agent, route, Run identifier, latency, and
              redacted error details. We do not sell personal data.
            </p>
          </section>

          <section>
            <h2>Your Cloudflare connection</h2>
            <p>
              You may optionally connect a Cloudflare Account ID and Workers AI API token so Runs
              use capacity from your account. Locus encrypts the token before storing it in Neon,
              never returns it after submission, and uses it only for your Agent Runs. Removing the
              connection from Settings deletes the stored encrypted credential. Cloudflare&apos;s terms,
              limits, and data policy also apply to those requests.
            </p>
          </section>

          <section>
            <h2>Retention and deletion</h2>
            <p>
              Terminal Agent Runs and their task, Step, proposal, and review evidence are
              automatically deleted after 30 days. Active and review-ready Runs remain available
              until they reach a terminal decision. Operational analytics and unfulfilled Agent Run
              access requests are deleted after 90 days. You may request earlier deletion of
              account-linked data through the Locus issue tracker without including private data in
              the request. Backup and provider deletion can take additional time.
            </p>
          </section>

          <section>
            <h2>Contact</h2>
            <p>
              Questions or a request deletion? Open a private-data request without including source
              code, task text, or credentials in the{" "}
              <a href={`${SUPPORT_URL}/issues/new`} className="doc-link">
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

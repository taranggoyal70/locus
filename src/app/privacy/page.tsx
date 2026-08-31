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
        <p className="mt-3 text-sm leading-7 text-muted-light">Effective August 30, 2026 · What Locus processes, keeps, and shares.</p>
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
              Hosted early access supports public repositories only. Source is fetched from GitHub and
              processed by Locus, the configured model provider, and its execution Sandbox. Locus
              does not intentionally retain a complete repository copy after execution, but generated
              diffs and source excerpts can appear in durable Run records. New GitHub OAuth
              connections are disabled during early access.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-paper">Durable Run records</h2>
            <p>
              To make Agent Runs durable and auditable, Locus stores task metadata, included and
              excluded file paths, Run Steps and status, generated change sets, Check evidence,
              review events, and token-usage measurements in Supabase. These records
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
            <h2 className="text-lg font-semibold text-paper">Providers and operational data</h2>
            <p>
              Clerk, Supabase, GitHub, and Vercel process data needed for authentication, persistence,
              repository intake, hosting, workflow execution, and Sandbox operation. Cloudflare Workers
              AI processes task instructions, admitted source, and tool results. Cloudflare states that
              Workers AI customer content is not used for model training without explicit consent. Server
              logs may include IP address, timestamp, user agent, route, Run identifier, latency, and
              redacted error details. We do not sell personal data.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-paper">Your Cloudflare connection</h2>
            <p>
              You may optionally connect a Cloudflare Account ID and Workers AI API token so Runs
              use capacity from your account. Locus encrypts the token before storing it in Supabase,
              never returns it after submission, and uses it only for your Agent Runs. Removing the
              connection from Settings deletes the stored encrypted credential. Cloudflare&apos;s terms,
              limits, and data policy also apply to those requests.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-paper">Retention and deletion</h2>
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
            <h2 className="text-lg font-semibold text-paper">Contact</h2>
            <p>
              Questions or a request deletion? Open a private-data request without including source
              code, task text, or credentials in the{" "}
              <a href={`${REPO_URL}/issues/new`} className="text-accent hover:underline">
                Locus issue tracker
              </a>.
            </p>
          </section>
        </div>
      </main>
    </MarketingShell>
  );
}

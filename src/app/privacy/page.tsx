import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { REPO_URL } from "@/lib/config";

export const metadata: Metadata = {
  title: "Privacy Policy — Locus",
  description: "How Locus handles your data.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-4">
          <Link href="/" className="flex items-center gap-3 text-paper">
            <Image src="/locus-mark.svg" width={24} height={24} alt="" />
            <span className="font-semibold">Locus</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-12">
        <h1 className="text-3xl font-semibold tracking-tight text-paper">Privacy Policy</h1>
        <p className="mt-2 text-xs text-muted">Last updated July 27, 2026</p>

        <div className="mt-8 space-y-6 text-sm leading-7 text-muted-light">
          <section>
            <h2 className="text-lg font-semibold text-paper">What we collect</h2>
            <p>
              Locus uses Clerk for authentication. When you create an account, Clerk stores your
              email address and authentication credentials on their infrastructure. Locus stores
              your account identifier, saved task metadata, API-key metadata, product-usage events,
              and—if you use billing—Stripe customer and subscription identifiers. We do not store
              passwords, complete payment-card details, or the plaintext value of an API key after
              it is first shown to you.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-paper">Repository data</h2>
            <p>
              In the current public beta, repository source is fetched from GitHub, processed in
              server memory, and returned to your browser. We do not persist repository contents.
              If you save a task, we store the repository identifier, task text, file counts,
              estimated savings, and timestamps so it can be reopened; we do not store the source
              files or uploaded task evidence with that saved task.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-paper">GitHub connections</h2>
            <p>
              If you connect GitHub, Locus stores your GitHub username, granted scopes, and OAuth
              access token in our application database until you disconnect the account. The
              connection is used only for GitHub features you request. Private-repository analysis
              is a planned Pro feature and is not currently sold.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-paper">Task evidence</h2>
            <p>
              Screenshot OCR runs locally in your browser; the image is not uploaded to Locus.
              PDFs, DOCX files, and text documents are sent to a Locus server route, processed in
              memory for text extraction, and immediately discarded. Extracted text is returned to
              your browser and is not stored on our servers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-paper">Analytics</h2>
            <p>
              Locus records first-party product events such as repository loads, context copies,
              API usage, and feedback so we can operate and improve the service. Hosting and server
              logs may include request metadata such as IP address, timestamp, route, and user
              agent for reliability, security, and rate limiting.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-paper">Service providers and retention</h2>
            <p>
              We rely on Clerk for authentication, Supabase for application data, Vercel for
              hosting, GitHub for repository access, and Stripe for billing. Data is retained while
              your account or saved records remain active and as needed for security, billing, and
              legal obligations. Delete saved tasks and API keys in the product; disconnect GitHub
              in Settings. For account-deletion requests, use the contact channel below.
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
    </div>
  );
}

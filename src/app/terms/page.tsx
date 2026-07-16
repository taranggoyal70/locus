import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — Locus",
  description: "Terms governing use of Locus.",
};

export default function TermsPage() {
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
        <h1 className="text-3xl font-semibold tracking-tight text-paper">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted">Last updated: July 2026</p>

        <div className="mt-8 space-y-6 text-sm leading-7 text-muted-light">
          <section>
            <h2 className="text-lg font-semibold text-paper">Service</h2>
            <p>
              Locus is an open-source tool that maps coding tasks to focused source-code slices.
              It is provided as-is, without warranty. The hosted version at locus-five-iota.vercel.app
              is a convenience deployment of the open-source project.
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
              Repository source code is processed transiently and is not stored. See our{" "}
              <Link href="/privacy" className="text-accent hover:underline">Privacy Policy</Link>{" "}
              for complete details on data handling.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-paper">Limitation of liability</h2>
            <p>
              Locus is provided &ldquo;as is&rdquo; without warranties of any kind. We are not
              liable for any damages arising from the use or inability to use the service,
              including but not limited to inaccurate code analysis results.
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
              We may update these terms as the service evolves. Material changes will be reflected
              in the &ldquo;Last updated&rdquo; date above.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

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
        <p className="mt-2 text-sm text-muted">Last updated: July 2026</p>

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
              When you analyze a repository, its public source code is fetched from GitHub,
              processed in memory on our server, and returned to your browser. We do not persist,
              log, or store repository contents. Analysis results exist only in your browser session
              and are discarded when you close the tab.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-paper">Task evidence</h2>
            <p>
              Screenshots, PDFs, and documents you upload for task evidence are processed
              server-side for text extraction and immediately discarded. Extracted text is returned
              to your browser and is not stored on our servers.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-paper">Local storage</h2>
            <p>
              We store a small list of recently analyzed repositories in your browser&apos;s
              localStorage to improve your experience. This data never leaves your browser.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-paper">Analytics</h2>
            <p>
              We do not use third-party analytics or tracking scripts. Server logs may record
              request metadata (IP address, timestamp, user agent) for security and rate-limiting
              purposes. These logs are rotated automatically and not shared with third parties.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-paper">Contact</h2>
            <p>
              Questions about this policy? Open an issue on{" "}
              <a href="https://github.com/taranggoyal70/locus" className="text-accent hover:underline">
                GitHub
              </a>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}

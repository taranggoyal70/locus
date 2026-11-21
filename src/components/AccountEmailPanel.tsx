import Link from "next/link";

type AccountEmailPanelProps = {
  email: string | null;
  verified: boolean;
};

/**
 * Whether the account's email is verified, and what that currently costs them.
 *
 * Self-serve admission requires a verified address, so this is the one setting
 * on the page that can be the reason Agent Runs are unavailable. It states the
 * consequence rather than the status alone: "unverified" is a fact, "unverified,
 * which is why you cannot start Runs" is the thing the reader needed.
 *
 * A verified account still gets a line. Confirming that something is fine is
 * what stops a user hunting through settings for a cause that is not here.
 */
export function AccountEmailPanel({ email, verified }: AccountEmailPanelProps) {
  if (verified) {
    return (
      <section className="rounded-card border border-line p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-ink">Email</h2>
            <p className="mt-1 text-sm text-ink-2">
              {email ?? "Your address"} is verified. Agent Run access is not limited by it.
            </p>
          </div>
          <Link
            href="/settings/account"
            className="rounded-chip border border-line-2 px-4 py-2.5 text-sm font-medium text-ink transition hover:border-ink/40 hover:text-ink"
          >
            Manage account
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-card border border-included/35 bg-included/[0.06] p-5">
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-muted">
        Action needed
      </p>
      <h2 className="mt-2 text-lg font-semibold tracking-[-0.02em] text-ink">
        Verify your email to start Agent Runs
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-2">
        {email
          ? `We sent a confirmation to ${email}.`
          : "Your account has no verified email address yet."}{" "}
        Run capacity is limited, and a verified address keeps it available to real
        accounts. Repo localization works either way.
      </p>
      <Link
        href="/settings/account"
        className="mt-5 inline-flex items-center gap-2 rounded-chip bg-ink px-4 py-2.5 text-sm font-medium text-canvas transition hover:bg-ink/90"
      >
        Verify email
        <span aria-hidden>→</span>
      </Link>
    </section>
  );
}

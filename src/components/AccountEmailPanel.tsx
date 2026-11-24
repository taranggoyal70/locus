import Link from "next/link";

import { primaryButton, secondaryButton } from "@/components/controls";
import { StateTag } from "@/components/StateTag";

type AccountEmailPanelProps = {
  email: string | null;
  verified: boolean;
};

const shell = "flex flex-col rounded-card border border-line-2 bg-surface p-6 sm:p-7";
const label = "font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted";
const heading = "mt-4 font-display text-[26px] font-normal leading-[1.1] tracking-[-0.012em] text-ink";

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
 *
 * Unverified is marked in ochre, the attention colour: orange belongs to the
 * Slice alone.
 */
export function AccountEmailPanel({ email, verified }: AccountEmailPanelProps) {
  if (verified) {
    return (
      <section className={shell}>
        <p className="flex items-center justify-between gap-3">
          <span className={label}>Account</span>
          <StateTag tone="passed">Verified</StateTag>
        </p>
        <h2 className={heading}>Email</h2>
        <p className="mt-3 text-[15px] leading-6 text-ink-2">
          <span className="break-all font-medium text-ink">{email ?? "Your address"}</span> is verified. Agent Run access is not limited by it.
        </p>
        <div className="mt-auto pt-6">
          <Link href="/settings/account" className={secondaryButton}>
            Manage account
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className={`${shell} border-widened/50`}>
      <p className="flex items-center justify-between gap-3">
        <span className={label}>Action needed</span>
        <StateTag tone="widened">Unverified</StateTag>
      </p>
      <h2 className={heading}>
        Verify your email to start Agent Runs
      </h2>
      <p className="mt-3 max-w-2xl wrap-anywhere text-[15px] leading-6 text-ink-2">
        {email
          ? `We sent a confirmation to ${email}.`
          : "Your account has no verified email address yet."}{" "}
        Run capacity is limited, and a verified address keeps it available to real
        accounts. Repo localization works either way.
      </p>
      <div className="mt-auto pt-6">
        <Link href="/settings/account" className={primaryButton}>
          Verify email
          <span aria-hidden>→</span>
        </Link>
      </div>
    </section>
  );
}

import type { AdmissionTier } from "@/lib/admission";

type AlphaSettingsNoticeProps = {
  /** The viewer's resolved Tier, so the notice describes their access rather than a default. */
  tier: AdmissionTier;
};

/**
 * The product boundary, told from the viewer's position.
 *
 * This previously stated one boundary for everyone: "Agent Runs remain limited
 * to invited partners." That was true while an invitation was the only
 * way in. It is false to a free account the moment self-serve opens, and false
 * to a paying one - and it is the kind of false that check:alpha-claims cannot
 * catch, because the sentence is accurate in the source and wrong only for the
 * person reading it.
 *
 * Every branch still declines to advertise a capability that is withheld. The
 * boundary being described is admission, not the capability release.
 */
export function AlphaSettingsNotice({ tier }: AlphaSettingsNoticeProps) {
  const body = {
    visitor:
      "Repo localization is free for signed-in users. Agent Runs are opening in "
      + "batches while the review and delivery boundaries are hardened.",
    free:
      "Repo localization is free and unmetered. Your plan includes 1 Agent Run at "
      + "a time and 3 per day on public repositories, ending at a review-ready "
      + "proposal. External GitHub delivery is off for every plan.",
    partner:
      "Repo localization is free and unmetered. As a design partner you "
      + "have 2 Agent Runs at a time and 10 per day on public repositories. "
      + "External GitHub delivery is off for every plan.",
    pro:
      "Repo localization is free and unmetered. Your plan includes 5 Agent Runs at "
      + "a time and 50 per day on public repositories. External GitHub delivery is "
      + "off for every plan.",
  }[tier];

  return (
    <section className="rounded-2xl border border-accent/25 bg-accent/[0.06] p-5">
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-accent">
        Public early access
      </p>
      <h2 className="mt-2 text-lg font-semibold tracking-[-0.02em] text-paper">
        {tier === "visitor" ? "Agent Runs are not enabled for this account" : "Your current access"}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-light">{body}</p>
    </section>
  );
}

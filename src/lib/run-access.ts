import type { AccountAdmission, AdmissionReason, AdmissionTier, RunQuota } from "@/lib/admission";
import type { RunUsage } from "@/lib/agent/run-usage";

/**
 * What the workspace needs to know about the account's Run access.
 *
 * The panel previously received a single `canStartRun` boolean and, when it was
 * false, said "Invite required". That was true while an invitation was the only
 * way in. It is wrong for someone on the waitlist, wrong for a suspended
 * account, and wrong for anyone who has simply used today's quota - three
 * different situations that a boolean collapses into one misleading sentence
 * telling the user to wait for something that is not coming.
 *
 * This is a view model, not a second policy: it carries the decision the server
 * already made, so the client can explain it rather than re-derive it.
 */
export type RunAccess = {
  canStart: boolean;
  tier: AdmissionTier;
  reason: AdmissionReason;
  quota: RunQuota;
  /**
   * What the account has spent against that quota, or null when it was not
   * read - for an account that cannot start a Run at all, the counts would be a
   * database round trip spent on a number nobody sees.
   */
  usage: RunUsage | null;
};

export function runAccessFromAdmission(
  admission: AccountAdmission,
  usage: RunUsage | null = null,
): RunAccess {
  return {
    canStart: admission.capabilities.runStart,
    tier: admission.tier,
    reason: admission.reason,
    quota: admission.runQuota,
    usage,
  };
}

/** The refusal a signed-out or unresolved client should assume. */
export const NO_RUN_ACCESS: RunAccess = {
  canStart: false,
  tier: "visitor",
  reason: "signed_out",
  quota: { maxActiveRuns: 0, maxDailyRuns: 0 },
  usage: null,
};

export type RunAccessCopy = {
  /** The action label on the launch control. */
  action: string;
  /** One sentence under it explaining what the user can do next. */
  explanation: string;
  /**
   * Where the action goes when it is not "start a Run". A refusal whose control
   * names an action the user cannot take is worse than one that says nothing:
   * "Request access" on a disabled button is a dead end wearing the costume of a
   * next step. Null means there is genuinely nowhere to send them, and the
   * control should read as a statement rather than as an offer.
   */
  href: string | null;
};

/**
 * What to tell the user about their Run access.
 *
 * Kept as a pure function beside the shape rather than inline in the panel, so
 * every refusal is visible in one place next to the reason that produces it.
 * Inline, the waitlist and suspended cases were a single `: "Invite required"`
 * branch that nobody would notice was wrong.
 *
 * No refusal here promises access that is not coming. A suspended account is not
 * told to wait for an invitation, and a waitlisted one is not told it has been
 * refused.
 */
export function runAccessCopy(access: RunAccess): RunAccessCopy {
  if (access.canStart) {
    const daily = access.quota.maxDailyRuns;
    const remaining = access.usage
      ? Math.max(0, daily - access.usage.dailyRuns)
      : null;

    // Offering an action that is certain to be refused is worse than saying so.
    // The server stays authoritative - this only declines to present a button
    // whose only outcome is a 429.
    if (remaining === 0) {
      return {
        action: "Daily Runs used",
        href: null,
        explanation:
          `You have used all ${daily} Agent ${daily === 1 ? "Run" : "Runs"} on this `
          + "plan in the last 24 hours. The allowance is a rolling window, so the "
          + "oldest Run frees a slot as it ages out.",
      };
    }

    const allowance = remaining === null
      ? `${daily} Agent ${daily === 1 ? "Run" : "Runs"} per day on this plan.`
      : `${remaining} of ${daily} Agent ${daily === 1 ? "Run" : "Runs"} left today.`;

    return {
      action: "Run task with Locus",
      href: null,
      explanation:
        `Executes in an isolated Sandbox. ${allowance} `
        + "GitHub delivery is disabled during early access.",
    };
  }

  switch (access.reason) {
    case "signed_out":
      return {
        action: "Sign in to run",
        href: "/sign-in",
        explanation:
          "Sign in to turn this Slice into a review-ready proposal. The Slice above "
          + "is complete either way.",
      };
    case "suspended":
      return {
        action: "Runs unavailable",
        href: "/support",
        explanation:
          "This account cannot start Agent Runs. Contact support if you believe that "
          + "is a mistake.",
      };
    case "unverified_email":
      return {
        action: "Verify your email",
        href: "/settings/account",
        explanation:
          "Confirm your email address to start Agent Runs. We ask because Run "
          + "capacity is limited and a verified address keeps it available to "
          + "real accounts.",
      };
    case "at_capacity":
      return {
        action: "Request access",
        href: "/pricing#request-access",
        explanation:
          "Free Agent Runs are at capacity for now. Request access and you can "
          + "still inspect the complete Slice above in the meantime.",
      };
    case "waitlist":
      return {
        action: "Request access",
        href: "/pricing#request-access",
        explanation:
          "Agent Runs are opening in batches. Request access and you can still inspect "
          + "the complete Slice above in the meantime.",
      };
    default:
      // Reached when a Tier holds runStart but the capability is unreleased, which
      // is a deployment state rather than anything the user did. Saying so beats
      // inventing a reason they could act on.
      return {
        action: "Runs unavailable",
        href: null,
        explanation:
          "Agent Runs are temporarily unavailable. The complete Slice above is "
          + "unaffected.",
      };
  }
}

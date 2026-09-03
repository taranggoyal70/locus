import type { AccountAdmission, AdmissionReason, AdmissionTier, RunQuota } from "@/lib/admission";

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
};

export function runAccessFromAdmission(admission: AccountAdmission): RunAccess {
  return {
    canStart: admission.capabilities.runStart,
    tier: admission.tier,
    reason: admission.reason,
    quota: admission.runQuota,
  };
}

/** The refusal a signed-out or unresolved client should assume. */
export const NO_RUN_ACCESS: RunAccess = {
  canStart: false,
  tier: "visitor",
  reason: "signed_out",
  quota: { maxActiveRuns: 0, maxDailyRuns: 0 },
};

export type RunAccessCopy = {
  /** The action label on the launch control. */
  action: string;
  /** One sentence under it explaining what the user can do next. */
  explanation: string;
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
    return {
      action: "Run task with Locus",
      explanation:
        `Executes in an isolated Sandbox. ${daily} Agent ${daily === 1 ? "Run" : "Runs"} `
        + "per day on this plan. GitHub delivery is disabled during early access.",
    };
  }

  switch (access.reason) {
    case "signed_out":
      return {
        action: "Sign in to run",
        explanation:
          "Sign in to turn this Slice into a review-ready proposal. The Slice above "
          + "is complete either way.",
      };
    case "suspended":
      return {
        action: "Runs unavailable",
        explanation:
          "This account cannot start Agent Runs. Contact support if you believe that "
          + "is a mistake.",
      };
    case "waitlist":
      return {
        action: "Request access",
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
        explanation:
          "Agent Runs are temporarily unavailable. The complete Slice above is "
          + "unaffected.",
      };
  }
}

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

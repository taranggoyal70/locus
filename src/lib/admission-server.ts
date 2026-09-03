import {
  admissionFromEnvironment,
  admissionWithCapabilities,
  selfServeMaxAccounts,
  selfServeOpen,
  CAPABILITY_RELEASE,
  type AccountAdmission,
  type AdmissionCapabilities,
} from "@/lib/admission";
import { primaryEmailVerified } from "@/lib/account-identity";
import {
  admitSelfServe,
  countSelfServeAdmissions,
  hasActiveSubscription,
  readStoredAdmission,
} from "@/lib/admission-store";
import { track } from "@/lib/analytics";
import { logger } from "@/lib/logger";

export type { AccountAdmission };

/**
 * Whether the deployment can admit one more self-serve account.
 *
 * With no ceiling configured this is true without touching the database, so an
 * operator who has not opted into a ceiling pays nothing for one.
 */
async function hasSelfServeCapacity(): Promise<boolean> {
  const ceiling = selfServeMaxAccounts();
  if (ceiling === null) return true;
  if (ceiling === 0) return false;
  return (await countSelfServeAdmissions()) < ceiling;
}

/**
 * The one place a request finds out what an account is allowed to do.
 *
 * This is the impure half: it gathers the two database inputs and hands them to
 * the pure decision. Everything about which tier wins, what it may do, and how
 * many Runs it gets lives in `@/lib/admission` and is reachable without a
 * database.
 *
 * The reads run concurrently because they are independent and this sits in front
 * of every authenticated page render; serialising them would put two round trips
 * on the critical path for no benefit.
 */
export async function admissionForAccount(
  userId: string | null,
): Promise<AccountAdmission> {
  // A signed-out request has no rows to read. Returning before touching the
  // database also means an unauthenticated flood cannot turn into database load.
  if (!userId) return admissionFromEnvironment(null);

  try {
    const [stored, subscriptionActive] = await Promise.all([
      readStoredAdmission(userId),
      hasActiveSubscription(userId),
    ]);

    // The signup barriers are evaluated only for a stranger arriving under
    // self-serve, which is the only case the resolver consults them for. An
    // account with an Admission record, an allowlisted partner, and a subscriber
    // all resolve without paying for the identity-provider round trip.
    const open = selfServeOpen();
    const admittingStranger = open && !stored;
    const [emailVerified, selfServeCapacity] = admittingStranger
      ? await Promise.all([primaryEmailVerified(userId), hasSelfServeCapacity()])
      : [false, false];

    return admissionWithCapabilities({
      userId,
      partnerUserIds: process.env.ALPHA_ALLOWED_USER_IDS,
      subscriptionActive,
      selfServeOpen: open,
      emailVerified,
      selfServeCapacity,
      stored,
    });
  } catch (error) {
    // Degrade to the invited-partner allowlist alone, with self-serve forced
    // closed regardless of the environment.
    //
    // The tempting fallback is "carry on with environment state", but the
    // suspension list lives in the row that just failed to load. Admitting
    // strangers to `free` while unable to read who is refused would let a
    // suspended account back in for the duration of the outage, which is when it
    // is least likely to be noticed.
    //
    // The allowlist is safe to honour because it is environment state that was
    // never in doubt, and it keeps the design partners producing Release 1
    // evidence working through a database incident.
    logger.error("admission.read_failed", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return admissionFromEnvironment(userId);
  }
}

/**
 * Whether the account holds one capability.
 *
 * The short-circuit is the point. An unreleased capability is held by no Tier at
 * all, so the answer is already known and resolving the Admission would be two
 * database reads spent to reach a refusal that could not have gone the other
 * way. Eight of the nine gates are unreleased today, which would otherwise have
 * meant every disabled route paying for a lookup on every request - including
 * from anyone who found the endpoint and decided to hold it open.
 *
 * The intersection in applyCapabilityRelease already guarantees the two agree,
 * so this is an optimisation rather than a second policy.
 */
export async function accountCan(
  userId: string | null,
  capability: keyof AdmissionCapabilities,
): Promise<boolean> {
  if (!CAPABILITY_RELEASE[capability]) return false;
  return (await admissionForAccount(userId)).capabilities[capability];
}

/**
 * Resolve the Admission and, for a stranger arriving while self-serve is open,
 * write the `free` grant that resolution would otherwise only imply.
 *
 * Called from the workspace, which is the moment an account first uses the
 * product rather than merely holds credentials. Deriving `free` from the flag on
 * every request would work, so this is not about access - it is about there
 * being a row. A row carries `granted_at`, which is the only record of when an
 * account arrived, and it gives an operator something to edit when they need to
 * change one account's tier.
 *
 * A failed write is logged and swallowed. The Admission it would have recorded
 * is the same one resolution already produced, so refusing to render the
 * workspace over a missing audit row would trade the product for the paperwork.
 */
export async function admitOnFirstUse(userId: string | null): Promise<AccountAdmission> {
  const admission = await admissionForAccount(userId);
  if (!userId) return admission;

  // Recorded before the self-serve guard, not after it. A refusal is the half of
  // the funnel that matters: how many accounts are sitting on the waitlist is
  // the number that decides whether to open wider, and instrumenting only the
  // admissions would have measured the successes and nothing else.
  //
  // Recorded here rather than in admissionForAccount because that runs on every
  // authenticated request and every capability check, which would produce a row
  // per page load and bury the signal under repeat traffic.
  void track({
    event: "admission_resolved",
    userId,
    properties: { tier: admission.tier, reason: admission.reason },
  });

  if (admission.reason !== "self_serve") return admission;

  try {
    await admitSelfServe(userId);
  } catch (error) {
    logger.error("admission.self_serve_record_failed", {
      reason: error instanceof Error ? error.message : "unknown",
    });
  }
  return admission;
}

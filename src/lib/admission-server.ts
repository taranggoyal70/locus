import {
  admissionFromEnvironment,
  admissionWithCapabilities,
  selfServeOpen,
  type AccountAdmission,
} from "@/lib/admission";
import { hasActiveSubscription, readStoredAdmission } from "@/lib/admission-store";
import { logger } from "@/lib/logger";

export type { AccountAdmission };

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
    return admissionWithCapabilities({
      userId,
      partnerUserIds: process.env.ALPHA_ALLOWED_USER_IDS,
      subscriptionActive,
      selfServeOpen: selfServeOpen(),
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

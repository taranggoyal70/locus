import { currentUser } from "@clerk/nextjs/server";

/**
 * Whether the signed-in account's primary email address is verified.
 *
 * This is the cheapest control that makes account creation cost something. Clerk
 * signup is free and instant, so a per-account Run quota is bypassed by making
 * more accounts; requiring a verified address raises that from "instant" to
 * "needs a working inbox each time". It is not a strong barrier - disposable
 * inboxes exist - but it is the difference between scripted and merely tedious.
 *
 * Fails closed on every uncertainty: no session, a mismatched session, a missing
 * address, or an unreadable one. Admitting an account because the identity
 * provider was slow is the wrong direction for a control whose whole job is to
 * cost the other side something.
 */
export async function primaryEmailVerified(userId: string): Promise<boolean> {
  try {
    const user = await currentUser();

    // The caller passes the id it authorised against. If the ambient session
    // does not match it, this answer is about a different account and must not
    // be used - that mismatch is the wrong-variable class of bug the tenant
    // guard exists to catch elsewhere.
    if (!user || user.id !== userId) return false;

    return user.primaryEmailAddress?.verification?.status === "verified";
  } catch {
    return false;
  }
}

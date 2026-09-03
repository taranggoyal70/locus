import {
  applyCapabilityRelease,
  capabilitiesForTier,
  CAPABILITY_RELEASE,
  resolveAdmission,
  type AdmissionCapabilities,
} from "@/lib/admission";

/**
 * The capability record every route handler and Server Component reads.
 *
 * The decision itself now lives in `@/lib/admission`: this is the impure edge
 * that supplies it with environment state. Keeping the edge thin is the point —
 * a handler asking "may this account start a Run?" should not be the place that
 * decides what an account is.
 *
 * The name is retained so this commit changes no call sites. It is inaccurate
 * once self-serve opens and will be renamed when the last controlled-alpha
 * assumption leaves the codebase.
 */
export type AlphaCapabilities = AdmissionCapabilities;

export function alphaCapabilitiesForUser(
  userId: string | null,
  allowedUserIds = process.env.ALPHA_ALLOWED_USER_IDS,
): AlphaCapabilities {
  const admission = resolveAdmission({
    userId,
    partnerUserIds: allowedUserIds,
    // Neither input is wired yet. Subscription state needs a database read this
    // synchronous signature cannot make, and self-serve stays closed until the
    // admission store and per-tier quotas are enforced on the Run path. Both are
    // stated explicitly rather than defaulted, so opening either is a visible
    // edit here rather than an accident somewhere upstream.
    subscriptionActive: false,
    selfServeOpen: false,
  });

  return applyCapabilityRelease(capabilitiesForTier(admission.tier), CAPABILITY_RELEASE);
}

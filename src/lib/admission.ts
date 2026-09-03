/**
 * Admission resolves an account to a Tier. See CONTEXT.md for the vocabulary.
 *
 * This module is deliberately pure: no Clerk, no Supabase, no `fetch`. Everything
 * it needs arrives as an argument, so the rules that decide who may start a Run
 * can be read and tested as a table rather than reconstructed from whichever
 * request handler happens to call them.
 */

/**
 * Ordered from least to most admitted. The order is load-bearing — `tierAtLeast`
 * compares by position — so a new Tier must be inserted at its rank rather than
 * appended for convenience.
 */
export const ADMISSION_TIERS = ["visitor", "free", "partner", "pro"] as const;

export type AdmissionTier = (typeof ADMISSION_TIERS)[number];

export function isAdmissionTier(value: unknown): value is AdmissionTier {
  return (
    typeof value === "string" && (ADMISSION_TIERS as readonly string[]).includes(value)
  );
}

/**
 * Rank comparison, so a call site can ask "is this account at least `free`?"
 * without enumerating every Tier above it. Enumerating is how a newly added Tier
 * silently loses access it should have inherited.
 */
export function tierAtLeast(tier: AdmissionTier, minimum: AdmissionTier): boolean {
  return ADMISSION_TIERS.indexOf(tier) >= ADMISSION_TIERS.indexOf(minimum);
}

/** One named thing an account may do. Derived from a Tier, never stored per account. */
export type AdmissionCapabilities = {
  runStart: boolean;
  githubConnect: boolean;
  privateRepoRead: boolean;
  teams: boolean;
  savingsClaims: boolean;
  delivery: boolean;
  billing: boolean;
};

/**
 * The product ladder, written once as a table.
 *
 * `free` is deliberately the whole loop up to a Review-ready proposal on a
 * public Repo: a stranger can arrive, run the agent, and read the evidence. What
 * it does not include is anything that writes outside Locus (`delivery`) or
 * reads something private (`privateRepoRead`), which is both the security
 * boundary and the reason to upgrade.
 *
 * `billing` is the one capability a higher tier can lack: invited partners are
 * comped, so showing them a payment surface would be wrong. Every other axis is
 * monotonic and a test enforces that, because a capability silently revoked by
 * an upgrade is the kind of bug nobody reports.
 */
const CAPABILITIES_BY_TIER: Record<AdmissionTier, AdmissionCapabilities> = {
  visitor: {
    runStart: false,
    githubConnect: false,
    privateRepoRead: false,
    teams: false,
    savingsClaims: false,
    delivery: false,
    billing: false,
  },
  free: {
    runStart: true,
    githubConnect: true,
    privateRepoRead: false,
    teams: false,
    savingsClaims: true,
    delivery: false,
    billing: true,
  },
  partner: {
    runStart: true,
    githubConnect: true,
    privateRepoRead: true,
    teams: false,
    savingsClaims: true,
    delivery: true,
    billing: false,
  },
  pro: {
    runStart: true,
    githubConnect: true,
    privateRepoRead: true,
    teams: true,
    savingsClaims: true,
    delivery: true,
    billing: true,
  },
};

/**
 * Copied on read. Callers pass this record into React trees and API responses,
 * and a shared frozen-by-convention object is one careless assignment away from
 * granting delivery to every account in the process.
 */
export function capabilitiesForTier(tier: AdmissionTier): AdmissionCapabilities {
  return { ...CAPABILITIES_BY_TIER[tier] };
}

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

/** How many Runs a Tier may hold open, and how many it may start in a day. */
export type RunQuota = {
  maxActiveRuns: number;
  maxDailyRuns: number;
};

/**
 * Run quota is the cost control, so it belongs to the Tier rather than to a pair
 * of global constants. A free account gets one Run at a time and three a day:
 * enough to answer "does this work on my repository?" in one sitting, and small
 * enough that an unattended signup cannot drain provider capacity.
 *
 * `partner` intentionally reproduces the 2/10 the controlled alpha already ran
 * on, so opening self-serve does not quietly change the allowance for the
 * accounts currently producing Release 1 evidence.
 *
 * `visitor` is zero rather than one. A visitor cannot start a Run at all, and a
 * quota that reads as "one free go" would be a lie the moment someone wired it
 * to a call site. Zero is outside the range `claim_agent_run_slot` accepts,
 * which is deliberate: reaching the claim with a visitor quota should fail
 * loudly rather than admit a Run.
 */
const RUN_QUOTA_BY_TIER: Record<AdmissionTier, RunQuota> = {
  visitor: { maxActiveRuns: 0, maxDailyRuns: 0 },
  free: { maxActiveRuns: 1, maxDailyRuns: 3 },
  partner: { maxActiveRuns: 2, maxDailyRuns: 10 },
  pro: { maxActiveRuns: 5, maxDailyRuns: 50 },
};

export function runQuotaForTier(tier: AdmissionTier): RunQuota {
  return { ...RUN_QUOTA_BY_TIER[tier] };
}

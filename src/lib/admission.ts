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

/**
 * Which capabilities have actually shipped, independent of which Tier deserves
 * them.
 *
 * The Tier table above describes the product ladder as designed. This describes
 * what is safe to expose today. The two are separate because they answer
 * different questions and change for different reasons: a tier gains a
 * capability when the pricing decision is made, and a capability is released
 * when its rollout, security review, and abuse controls are finished.
 *
 * Collapsing them is how a refactor grants external GitHub writes to every
 * account by accident. Keeping them apart means widening access is always an
 * edit to this record, reviewable on its own, with a test asserting the exact
 * shape production ends up in.
 */
export const CAPABILITY_RELEASE: AdmissionCapabilities = {
  runStart: true,
  githubConnect: false,
  privateRepoRead: false,
  teams: false,
  savingsClaims: false,
  delivery: false,
  billing: false,
};

/**
 * Intersection, never union. A released capability the Tier does not hold stays
 * withheld, so this can only ever take access away. That direction is the whole
 * safety property: a mistake in the release record under-grants.
 */
export function applyCapabilityRelease(
  capabilities: AdmissionCapabilities,
  release: AdmissionCapabilities,
): AdmissionCapabilities {
  return {
    runStart: capabilities.runStart && release.runStart,
    githubConnect: capabilities.githubConnect && release.githubConnect,
    privateRepoRead: capabilities.privateRepoRead && release.privateRepoRead,
    teams: capabilities.teams && release.teams,
    savingsClaims: capabilities.savingsClaims && release.savingsClaims,
    delivery: capabilities.delivery && release.delivery,
    billing: capabilities.billing && release.billing,
  };
}

/**
 * Whether a signed-in stranger is admitted to `free` or held on the waitlist.
 *
 * One exact word, `open`, case-insensitive after trimming. Deliberately not
 * "true", "1", "yes", or "on": this is the variable that exposes provider
 * capacity to the public internet, and those are exactly the values a hurried
 * edit or a templated config produces by accident. Requiring a word that means
 * nothing else in this codebase means the flag can only be set on purpose.
 *
 * Absent means closed, so a deployment that has never heard of this variable
 * stays invite-only.
 */
export function selfServeOpen(
  environment: { LOCUS_SELF_SERVE?: string } = {
    LOCUS_SELF_SERVE: process.env["LOCUS_SELF_SERVE"],
  },
): boolean {
  return environment.LOCUS_SELF_SERVE?.trim().toLowerCase() === "open";
}

/** Which rule produced a Tier. Carried so a refusal can explain itself. */
export type AdmissionReason =
  | "signed_out"
  | "waitlist"
  | "suspended"
  | "self_serve"
  | "partner_allowlist"
  | "operator_grant"
  | "subscription";

export type Admission = {
  tier: AdmissionTier;
  reason: AdmissionReason;
};

export type AdmissionInput = {
  userId: string | null | undefined;
  /** Comma-separated Clerk ids from ALPHA_ALLOWED_USER_IDS. */
  partnerUserIds: string | undefined;
  subscriptionActive: boolean;
  /** Whether a stranger who signs in is admitted to `free` or held on the waitlist. */
  selfServeOpen: boolean;
  /**
   * The account's durable Admission record, or null when it has none. Absent
   * means "not yet decided" and falls through to the rules below; a stored
   * `visitor` means "explicitly refused" and overrides all of them.
   */
  stored?: { tier: AdmissionTier; source: AdmissionSourceName } | null;
};

/** Mirrors the source check constraint in migration 018. */
type AdmissionSourceName = "self_serve" | "operator" | "subscription";

const REASON_FOR_STORED_SOURCE: Record<AdmissionSourceName, AdmissionReason> = {
  operator: "operator_grant",
  subscription: "subscription",
  self_serve: "self_serve",
};

function isAllowlistedPartner(userId: string, partnerUserIds: string | undefined): boolean {
  return (partnerUserIds ?? "")
    .split(",")
    .some((entry) => entry.trim() === userId);
}

/**
 * The single decision that answers "who is this account?".
 *
 * Every rule that matches produces a candidate and the highest-ranked one wins,
 * rather than the first rule in source order. A design partner who later pays
 * should gain the paid tier, not keep the comped one because the allowlist
 * happened to be checked first, and rank comparison makes that automatic for
 * every future tier.
 *
 * `selfServeOpen` is what actually opens the product. Until it is true a signed-in
 * stranger resolves to `visitor` with reason `waitlist`, which is the current
 * invite-only behavior expressed as data instead of as a hard-coded `false`.
 */
export function resolveAdmission(input: AdmissionInput): Admission {
  // A signed-out request is decided before the allowlist is consulted. Splitting
  // "user_founder,," yields an empty entry, and comparing that against an empty
  // userId would admit every anonymous request as a partner.
  if (!input.userId) return { tier: "visitor", reason: "signed_out" };

  // Refusal is not a candidate, it is a verdict. A stored `visitor` has to beat
  // the allowlist, the subscription, and self-serve alike: if it merely competed
  // on rank, suspending an abusive account would do nothing at all to one who
  // also happens to be a subscriber, which is the account most worth suspending.
  if (input.stored?.tier === "visitor") return { tier: "visitor", reason: "suspended" };

  const candidates: Admission[] = [];
  if (input.stored) {
    candidates.push({
      tier: input.stored.tier,
      reason: REASON_FOR_STORED_SOURCE[input.stored.source],
    });
  }
  if (input.subscriptionActive) candidates.push({ tier: "pro", reason: "subscription" });
  if (isAllowlistedPartner(input.userId, input.partnerUserIds)) {
    candidates.push({ tier: "partner", reason: "partner_allowlist" });
  }
  if (input.selfServeOpen) candidates.push({ tier: "free", reason: "self_serve" });

  return candidates.reduce<Admission>(
    (best, candidate) => (tierAtLeast(candidate.tier, best.tier) ? candidate : best),
    { tier: "visitor", reason: "waitlist" },
  );
}

/** A resolved Tier together with everything it decides. */
export type AccountAdmission = Admission & {
  capabilities: AdmissionCapabilities;
  runQuota: RunQuota;
};

/**
 * Resolve, then attach what the Tier decides, with no I/O anywhere.
 *
 * Callers want the capabilities and the quota, not the tier name, and every one
 * of them looking those up separately is three chances to pair a tier with
 * another tier's limits. Keeping this pure is what lets a route test exercise
 * the real tables without a database.
 */
export function admissionWithCapabilities(input: AdmissionInput): AccountAdmission {
  const admission = resolveAdmission(input);
  return {
    ...admission,
    capabilities: applyCapabilityRelease(
      capabilitiesForTier(admission.tier),
      CAPABILITY_RELEASE,
    ),
    runQuota: runQuotaForTier(admission.tier),
  };
}

/**
 * Admission from environment state alone: no database read, self-serve forced
 * closed, no subscription.
 *
 * This is the answer for a signed-out request, the fallback when the Admission
 * rows cannot be read, and the shape a route test wants when it is asserting
 * something other than tier resolution. Naming it once keeps those three honest
 * about being the same thing - the outage fallback in particular was a
 * hand-copied version of this, which is how a fallback drifts from the behavior
 * it is meant to fall back to.
 */
export function admissionFromEnvironment(userId: string | null): AccountAdmission {
  return admissionWithCapabilities({
    userId,
    partnerUserIds: process.env["ALPHA_ALLOWED_USER_IDS"],
    subscriptionActive: false,
    selfServeOpen: false,
  });
}

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

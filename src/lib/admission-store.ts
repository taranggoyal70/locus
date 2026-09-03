import { isAdmissionTier, type AdmissionTier } from "@/lib/admission";
import { tenantClient } from "@/lib/supabase-tenant";

/** How an Admission record came to exist. Mirrors the source check in migration 018. */
export type AdmissionSource = "self_serve" | "operator" | "subscription";

export type StoredAdmission = {
  tier: AdmissionTier;
  source: AdmissionSource;
};

/** Postgres unique_violation. The only insert failure that is a lost race rather than a bug. */
const UNIQUE_VIOLATION = "23505";

function toStoredAdmission(row: { tier: string; source: string }): StoredAdmission {
  // Rows outlive deploys. A tier that was removed from the code but is still
  // stored must be rejected here, at the boundary, rather than handed to
  // capabilitiesForTier where it would index the table as undefined and throw
  // somewhere with no connection to the cause.
  if (!isAdmissionTier(row.tier)) {
    throw new Error(`Stored Admission has an unknown tier: ${row.tier}`);
  }
  return { tier: row.tier, source: row.source as AdmissionSource };
}

/**
 * The account's stored Admission, or null when it has none.
 *
 * Null means "not yet decided" and lets the resolver fall through to the
 * allowlist, subscription state, and self-serve. That is why a read failure
 * throws instead of returning null: swallowing a database error would turn an
 * operator's explicit `visitor` refusal into "no record" during an outage, which
 * is how a suspended account gets back in.
 */
export async function readStoredAdmission(userId: string): Promise<StoredAdmission | null> {
  const db = tenantClient(userId);
  const { data, error } = await db
    .from("account_admissions")
    .select("tier,source")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`Admission could not be read: ${error.message}`);
  return data ? toStoredAdmission(data) : null;
}

/**
 * Admit an account to `free` on its first self-serve visit, and do nothing at
 * all if it already has an Admission.
 *
 * Read-then-insert rather than an upsert, because an upsert would overwrite. A
 * self-serve visit must never be able to demote a pro account or reinstate one
 * an operator refused, and those are exactly the accounts that keep visiting.
 * The insert is therefore only ever reached for an account with no row.
 */
export async function admitSelfServe(userId: string): Promise<StoredAdmission> {
  const existing = await readStoredAdmission(userId);
  if (existing) return existing;

  const db = tenantClient(userId);
  const { error } = await db
    .from("account_admissions")
    .insert({ user_id: userId, tier: "free", source: "self_serve" })
    .select("tier,source")
    .single();

  if (!error) return { tier: "free", source: "self_serve" };

  // Two tabs, one new account: the loser's insert violates the primary key. The
  // right answer is the row that landed, not an error the user has to read. Any
  // other failure is a real one and must not be reported as an admission.
  if (error.code === UNIQUE_VIOLATION) {
    const settled = await readStoredAdmission(userId);
    if (settled) return settled;
  }
  throw new Error(`Admission could not be recorded: ${error.message}`);
}

import { sql, type Kysely } from "kysely";

import { selfServeOpen } from "@/lib/admission";
import { sharedCloudflareConfigured } from "@/lib/agent/provider-config";
import { databaseConfigured, db, type Database } from "@/lib/db";
import { SCHEMA_VERSION } from "@/lib/db/schema";

type Environment = Record<string, string | undefined>;

/** Whether the database answers and has the schema this build expects. */
export type DatabaseProbe = (environment: Environment) => Promise<boolean>;

const PROBE_TIMEOUT_MS = 5_000;

function configured(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function credentialEncryptionConfigured(value: string | undefined): boolean {
  if (!value) return false;
  try {
    return Buffer.from(value, "base64").length === 32;
  } catch {
    return false;
  }
}

function httpsUrl(value: string | undefined): boolean {
  if (!configured(value)) return false;
  try {
    return new URL(value as string).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Ready means the newest migration this build knows about is recorded in the
 * database. That one query proves the connection string works, the server
 * answers, and the schema is the one the code was written against: a deploy that
 * lands before its migration reports unready rather than failing on its first
 * write.
 */
export async function schemaIsCurrent(database: Kysely<Database>): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("database probe timed out")), PROBE_TIMEOUT_MS);
    });
    const recorded = sql<{ ready: boolean }>`select exists (
      select 1 from public.schema_migrations where name = ${SCHEMA_VERSION}
    ) as ready`.execute(database);
    const result = await Promise.race([recorded, timeout]);
    return result.rows[0]?.ready === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export const probeDatabase: DatabaseProbe = async (environment) =>
  databaseConfigured(environment) && schemaIsCurrent(db());

export async function productionReadiness(
  environment: Environment = process.env,
  databaseReady: DatabaseProbe = probeDatabase,
) {
  const missing: string[] = [];
  if (!(await databaseReady(environment))) missing.push("database");
  if (
    !configured(environment.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
    || !configured(environment.CLERK_SECRET_KEY)
  ) missing.push("authentication");
  // Admission has two doors. A deployment is misconfigured only when both are
  // shut: an empty allowlist used to mean nobody could start a Run, but with
  // self-serve open it is the normal and intended state. Continuing to require
  // the allowlist would report a healthy public deployment as unready, and an
  // unready signal nobody believes is worse than none.
  //
  // This supersedes the free-beta branch's LOCUS_PUBLIC_BETA_ENABLED, which
  // expressed the same intent as a single boolean. The Tier ladder carries it
  // with per-tier quota, a verified-email barrier, and an account ceiling, and
  // it accepts only the exact word `open` rather than "true".
  const selfServe = selfServeOpen(environment);
  if (!configured(environment.ALPHA_ALLOWED_USER_IDS) && !selfServe) {
    missing.push("run_admission");
  }

  const providerReady = sharedCloudflareConfigured(environment)
    && credentialEncryptionConfigured(environment.LOCUS_CREDENTIAL_ENCRYPTION_KEY);
  if (!providerReady) missing.push("agent_provider");
  if (!configured(environment.CRON_SECRET)) missing.push("retention_cron");

  const alerting = httpsUrl(environment.OPS_ALERT_WEBHOOK_URL)
    ? "webhook" as const
    : environment.OPS_EXTERNAL_HEALTHCHECK?.trim() === "github_actions"
      ? "external_health_check" as const
      : "structured_logs_only" as const;
  if (alerting === "structured_logs_only") missing.push("alerting");

  return {
    ready: missing.length === 0,
    admission: selfServe ? "self_serve" as const : "invite_only" as const,
    missing,
    alerting,
  };
}

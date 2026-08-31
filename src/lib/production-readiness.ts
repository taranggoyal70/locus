import { sharedCloudflareConfigured } from "@/lib/agent/provider-config";

type Environment = Record<string, string | undefined>;
type DatabaseRequest = (input: string | URL, init?: RequestInit) => Promise<Response>;

const FREE_BETA_SCHEMA_PATHS = [
  "/agent_provider_credentials",
  "/agent_provider_daily_claims",
  "/rpc/claim_agent_provider_daily_slot",
  "/rpc/claim_agent_run_slot",
] as const;

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

function parsedHttpsUrl(value: string | undefined): URL | null {
  if (!configured(value)) return null;
  try {
    const url = new URL(value as string);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function httpsUrl(value: string | undefined): boolean {
  return parsedHttpsUrl(value) !== null;
}

function legacySupabaseClaims(value: string): { ref?: unknown; role?: unknown } | null {
  const payload = value.split(".")[1];
  if (!payload) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function supabaseKey(
  value: string | undefined,
  modernPrefix: "sb_publishable_" | "sb_secret_",
  legacyRole: "anon" | "service_role",
  projectRef: string,
): string | null {
  const key = value?.trim() ?? "";
  if (key.startsWith(modernPrefix) && key.length >= 24) return key;
  if (!key.startsWith("eyJ") || key.length < 100) return null;
  const claims = legacySupabaseClaims(key);
  return claims?.role === legacyRole && claims.ref === projectRef ? key : null;
}

function supabaseConfig(environment: Environment) {
  const url = parsedHttpsUrl(environment.NEXT_PUBLIC_SUPABASE_URL);
  if (!url || !/^[a-z0-9-]+\.supabase\.co$/i.test(url.hostname)) return null;
  const projectRef = url.hostname.split(".")[0];
  const publicKey = supabaseKey(
    environment.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    "sb_publishable_",
    "anon",
    projectRef,
  );
  const serviceKey = supabaseKey(
    environment.SUPABASE_SERVICE_ROLE_KEY,
    "sb_secret_",
    "service_role",
    projectRef,
  );
  return publicKey && serviceKey ? { url, publicKey, serviceKey } : null;
}

function databaseProbeHeaders(key: string): Record<string, string> {
  return key.startsWith("eyJ")
    ? { apikey: key, Authorization: `Bearer ${key}` }
    : { apikey: key };
}

async function databaseCredentialsWork(
  config: NonNullable<ReturnType<typeof supabaseConfig>>,
  request: DatabaseRequest,
): Promise<boolean> {
  // Supabase's PostgREST OpenAPI root is intentionally admin-only. A valid
  // publishable/anon key receives 401 there, so using the same endpoint for
  // both credentials produces a false degraded health signal. Auth settings
  // is a safe public-key probe; the service-key PostgREST probe still proves
  // that the database API is reachable with elevated server credentials.
  const agentRunColumns = new URL("/rest/v1/agent_runs", config.url);
  agentRunColumns.searchParams.set("select", "provider,execution_mode");
  agentRunColumns.searchParams.set("limit", "0");
  const probes = [
    { endpoint: new URL("/auth/v1/settings", config.url), key: config.publicKey },
    { endpoint: new URL("/rest/v1/", config.url), key: config.serviceKey },
    { endpoint: agentRunColumns, key: config.serviceKey },
  ];
  try {
    const responses = await Promise.all(probes.map(({ endpoint, key }) => request(endpoint, {
        method: "GET",
        headers: databaseProbeHeaders(key),
        signal: AbortSignal.timeout(5_000),
      })));
    if (!responses.every((response) => response.ok)) return false;
    const openApi = await responses[1].json() as { paths?: Record<string, unknown> };
    return FREE_BETA_SCHEMA_PATHS.every((path) => Object.hasOwn(openApi.paths ?? {}, path));
  } catch {
    return false;
  }
}

export async function productionReadiness(
  environment: Environment = process.env,
  request: DatabaseRequest = fetch,
) {
  const missing: string[] = [];
  const database = supabaseConfig(environment);
  if (!database || !(await databaseCredentialsWork(database, request))) missing.push("database");
  if (
    !configured(environment.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
    || !configured(environment.CLERK_SECRET_KEY)
  ) missing.push("authentication");
  const publicBetaEnabled = environment.LOCUS_PUBLIC_BETA_ENABLED?.trim().toLowerCase() === "true";
  if (!configured(environment.ALPHA_ALLOWED_USER_IDS) && !publicBetaEnabled) {
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
    missing,
    alerting,
  };
}

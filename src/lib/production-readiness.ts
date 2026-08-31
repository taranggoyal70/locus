type Environment = Record<string, string | undefined>;
type DatabaseRequest = (input: string | URL, init?: RequestInit) => Promise<Response>;

const GATEWAY_AGENT_MODELS = new Set([
  "openai/gpt-5.6-sol",
  "openai/gpt-5.6-terra",
]);

function configured(value: string | undefined): boolean {
  return Boolean(value?.trim());
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
  const probes = [
    { endpoint: new URL("/auth/v1/settings", config.url), key: config.publicKey },
    { endpoint: new URL("/rest/v1/", config.url), key: config.serviceKey },
  ];
  try {
    const responses = await Promise.all(probes.map(({ endpoint, key }) => request(endpoint, {
        method: "GET",
        headers: databaseProbeHeaders(key),
        signal: AbortSignal.timeout(5_000),
      })));
    return responses.every((response) => response.ok);
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
  if (!configured(environment.ALPHA_ALLOWED_USER_IDS)) missing.push("run_admission");

  const model = environment.LOCUS_AGENT_MODEL?.trim();
  const providerReady = configured(model) && GATEWAY_AGENT_MODELS.has(model as string);
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

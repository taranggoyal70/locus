type Environment = Record<string, string | undefined>;

function configured(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function httpsUrl(value: string | undefined): boolean {
  if (!configured(value)) return false;
  try {
    return new URL(value as string).protocol === "https:";
  } catch {
    return false;
  }
}

function supabaseServiceKey(value: string | undefined): boolean {
  const key = value?.trim() ?? "";
  return (key.startsWith("sb_secret_") && key.length >= 24)
    || (key.startsWith("eyJ") && key.length >= 100);
}

export function productionReadiness(environment: Environment = process.env) {
  const missing: string[] = [];
  if (
    !httpsUrl(environment.NEXT_PUBLIC_SUPABASE_URL)
    || !supabaseServiceKey(environment.SUPABASE_SERVICE_ROLE_KEY)
  ) missing.push("database");
  if (
    !configured(environment.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
    || !configured(environment.CLERK_SECRET_KEY)
  ) missing.push("authentication");
  if (!configured(environment.ALPHA_ALLOWED_USER_IDS)) missing.push("run_admission");

  const model = environment.LOCUS_AGENT_MODEL?.trim();
  const providerReady = configured(model)
    && (!model?.startsWith("google/") || configured(environment.GOOGLE_GENERATIVE_AI_API_KEY));
  if (!providerReady) missing.push("agent_provider");
  if (!configured(environment.CRON_SECRET)) missing.push("retention_cron");

  return {
    ready: missing.length === 0,
    missing,
    alerting: httpsUrl(environment.OPS_ALERT_WEBHOOK_URL)
      ? "webhook" as const
      : "structured_logs_only" as const,
  };
}

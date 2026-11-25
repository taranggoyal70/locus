export const CLOUDFLARE_AGENT_MODEL = "@cf/qwen/qwen3.8-27b";
export const CLOUDFLARE_PROVIDER = "cloudflare-workers-ai";
/**
 * Shared Runs the whole deployment admits per UTC day, across every account.
 * One by default because the Workers Free allocation (10,000 neurons a day) pays
 * for roughly one substantial Run. Raise it with LOCUS_SHARED_DAILY_RUN_LIMIT
 * only when the Cloudflare account behind the shared pool can pay for more.
 */
export const DEFAULT_SHARED_DAILY_RUN_LIMIT = 1;
/** The bound `claim_agent_provider_daily_slot` itself enforces. */
export const MAX_SHARED_DAILY_RUN_LIMIT = 100;
/** Shared Runs one person may start per UTC day, however large the pool is. */
export const SHARED_RUNS_PER_PERSON_PER_DAY = 1;
export const SHARED_RUN_TOKEN_BUDGET = 100_000;

export type AgentExecutionMode = "shared" | "byok";

export type CloudflareCredential = {
  accountId: string;
  apiToken: string;
};

type ProviderEnvironment = Record<string, string | undefined>;

export class AgentProviderConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentProviderConfigurationError";
  }
}

export function resolveSharedDailyRunLimit(
  environment: ProviderEnvironment = process.env,
): number {
  const configured = environment.LOCUS_SHARED_DAILY_RUN_LIMIT?.trim();
  if (!configured) return DEFAULT_SHARED_DAILY_RUN_LIMIT;
  if (!/^\d+$/.test(configured)) {
    throw new AgentProviderConfigurationError(
      "LOCUS_SHARED_DAILY_RUN_LIMIT must be an integer.",
    );
  }
  const limit = Number(configured);
  if (limit < 1 || limit > MAX_SHARED_DAILY_RUN_LIMIT) {
    throw new AgentProviderConfigurationError(
      `LOCUS_SHARED_DAILY_RUN_LIMIT must be between 1 and ${MAX_SHARED_DAILY_RUN_LIMIT}.`,
    );
  }
  return limit;
}

/**
 * Whether this Clerk user operates the deployment. Owners' shared Runs skip the
 * daily limits, both the per-person one and the deployment ceiling, so the
 * operator can verify production on a day the public has used the pool. They
 * still take the shared provider lease and the 100,000-token cap.
 */
export function isDeploymentOwner(
  userId: string,
  environment: ProviderEnvironment = process.env,
): boolean {
  if (!userId) return false;
  return (environment.LOCUS_OWNER_USER_IDS ?? "")
    .split(",")
    .some((entry) => entry.trim() === userId);
}

export function isAgentExecutionMode(value: unknown): value is AgentExecutionMode {
  return value === "shared" || value === "byok";
}

export function normalizeCloudflareAccountId(value: string): string {
  const accountId = value.trim().toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(accountId)) {
    throw new AgentProviderConfigurationError(
      "Cloudflare Account ID must be exactly 32 hexadecimal characters.",
    );
  }
  return accountId;
}

export function normalizeCloudflareApiToken(value: string): string {
  const apiToken = value.trim();
  if (apiToken.length < 20 || apiToken.length > 512) {
    throw new AgentProviderConfigurationError(
      "Cloudflare API token must be between 20 and 512 characters.",
    );
  }
  return apiToken;
}

export function cloudflareOpenAIBaseUrl(accountId: string): string {
  const normalized = normalizeCloudflareAccountId(accountId);
  return `https://api.cloudflare.com/client/v4/accounts/${normalized}/ai/v1`;
}

export function resolveSharedCloudflareCredential(
  environment: ProviderEnvironment = process.env,
): CloudflareCredential {
  const model = environment.LOCUS_AGENT_MODEL?.trim();
  if (model !== CLOUDFLARE_AGENT_MODEL) {
    throw new AgentProviderConfigurationError(
      `Agent Runs require the reviewed Cloudflare model ${CLOUDFLARE_AGENT_MODEL}.`,
    );
  }
  const accountId = normalizeCloudflareAccountId(
    environment.CLOUDFLARE_ACCOUNT_ID ?? "",
  );
  const apiToken = normalizeCloudflareApiToken(environment.CLOUDFLARE_API_TOKEN ?? "");
  return { accountId, apiToken };
}

export function sharedCloudflareConfigured(
  environment: ProviderEnvironment = process.env,
): boolean {
  try {
    resolveSharedCloudflareCredential(environment);
    return true;
  } catch {
    return false;
  }
}

export function providerCapacityKey(input: {
  executionMode: AgentExecutionMode;
  userId: string;
}): string {
  return input.executionMode === "shared"
    ? `${CLOUDFLARE_PROVIDER}:shared`
    : `${CLOUDFLARE_PROVIDER}:byok:${input.userId}`;
}

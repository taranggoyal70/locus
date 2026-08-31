export const CLOUDFLARE_AGENT_MODEL = "@cf/qwen/qwen3.8-27b";
export const CLOUDFLARE_PROVIDER = "cloudflare-workers-ai";
export const SHARED_DAILY_RUN_LIMIT = 1;
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

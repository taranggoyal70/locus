import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

import { loadCloudflareCredential } from "@/lib/agent/provider-credential-store";
import {
  CLOUDFLARE_AGENT_MODEL,
  CLOUDFLARE_PROVIDER,
  cloudflareOpenAIBaseUrl,
  resolveSharedCloudflareCredential,
  type AgentExecutionMode,
  type CloudflareCredential,
} from "@/lib/agent/provider-config";

export function createCloudflareAgentModel(
  credential: CloudflareCredential,
) {
  return createOpenAICompatible({
    name: CLOUDFLARE_PROVIDER,
    baseURL: cloudflareOpenAIBaseUrl(credential.accountId),
    apiKey: credential.apiToken,
    supportsStructuredOutputs: true,
  }).chatModel(CLOUDFLARE_AGENT_MODEL);
}

export async function resolveRunAgentModel(input: {
  userId: string;
  executionMode: AgentExecutionMode;
  frozenModel: string;
}): Promise<LanguageModel> {
  if (input.frozenModel !== CLOUDFLARE_AGENT_MODEL) {
    throw new Error("Run model is outside the reviewed Cloudflare policy.");
  }
  const credential = input.executionMode === "shared"
    ? resolveSharedCloudflareCredential()
    : await loadCloudflareCredential({ userId: input.userId });
  if (!credential) {
    throw new Error("The Run owner's Cloudflare connection is unavailable.");
  }
  return createCloudflareAgentModel(credential);
}

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  decryptProviderToken,
  encryptProviderToken,
} from "@/lib/agent/provider-credential";
import {
  CLOUDFLARE_PROVIDER,
  type CloudflareCredential,
} from "@/lib/agent/provider-config";
import type { Database } from "@/lib/database.types";
import { tenantClient } from "@/lib/supabase-tenant";

type CredentialDatabase = SupabaseClient<Database>;

function encryptionKey(environment: Record<string, string | undefined> = process.env): string {
  return environment.LOCUS_CREDENTIAL_ENCRYPTION_KEY ?? "";
}

export async function cloudflareCredentialStatus(
  userId: string,
  db: CredentialDatabase = tenantClient(userId),
): Promise<{ configured: boolean; accountIdSuffix: string | null }> {
  const { data, error } = await db
    .from("agent_provider_credentials")
    .select("account_id")
    .eq("user_id", userId)
    .eq("provider", CLOUDFLARE_PROVIDER)
    .maybeSingle();
  if (error) throw new Error("Could not read provider connection status.");
  return {
    configured: Boolean(data),
    accountIdSuffix: data?.account_id.slice(-6) ?? null,
  };
}

export async function saveCloudflareCredential(input: {
  userId: string;
  credential: CloudflareCredential;
  environment?: Record<string, string | undefined>;
  db?: CredentialDatabase;
}): Promise<void> {
  const db = input.db ?? tenantClient(input.userId);
  const encryptedApiToken = encryptProviderToken({
    apiToken: input.credential.apiToken,
    userId: input.userId,
    encryptionKey: encryptionKey(input.environment),
  });
  const { error } = await db.from("agent_provider_credentials").upsert({
    user_id: input.userId,
    provider: CLOUDFLARE_PROVIDER,
    account_id: input.credential.accountId,
    encrypted_api_token: encryptedApiToken,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,provider" });
  if (error) throw new Error("Could not save provider connection.");
}

export async function loadCloudflareCredential(input: {
  userId: string;
  environment?: Record<string, string | undefined>;
  db?: CredentialDatabase;
}): Promise<CloudflareCredential | null> {
  const db = input.db ?? tenantClient(input.userId);
  const { data, error } = await db
    .from("agent_provider_credentials")
    .select("account_id,encrypted_api_token")
    .eq("user_id", input.userId)
    .eq("provider", CLOUDFLARE_PROVIDER)
    .maybeSingle();
  if (error) throw new Error("Could not load provider connection.");
  if (!data) return null;
  return {
    accountId: data.account_id,
    apiToken: decryptProviderToken({
      encrypted: data.encrypted_api_token,
      userId: input.userId,
      encryptionKey: encryptionKey(input.environment),
    }),
  };
}

export async function deleteCloudflareCredential(
  userId: string,
  db: CredentialDatabase = tenantClient(userId),
): Promise<void> {
  const { error } = await db
    .from("agent_provider_credentials")
    .delete()
    .eq("provider", CLOUDFLARE_PROVIDER)
    .eq("user_id", userId);
  if (error) throw new Error("Could not remove provider connection.");
}

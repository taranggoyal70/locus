import type { Kysely } from "kysely";

import {
  decryptProviderToken,
  encryptProviderToken,
} from "@/lib/agent/provider-credential";
import {
  CLOUDFLARE_PROVIDER,
  type CloudflareCredential,
} from "@/lib/agent/provider-config";
import { tenantDb, type Database } from "@/lib/db";

type CredentialDatabase = Kysely<Database>;

function encryptionKey(environment: Record<string, string | undefined> = process.env): string {
  return environment.LOCUS_CREDENTIAL_ENCRYPTION_KEY ?? "";
}

export async function cloudflareCredentialStatus(
  userId: string,
  db: CredentialDatabase = tenantDb(userId),
): Promise<{ configured: boolean }> {
  try {
    const row = await db
      .selectFrom("agent_provider_credentials")
      .select("user_id")
      .where("user_id", "=", userId)
      .where("provider", "=", CLOUDFLARE_PROVIDER)
      .executeTakeFirst();
    return { configured: Boolean(row) };
  } catch (error) {
    throw new Error("Could not read provider connection status.", { cause: error });
  }
}

export async function saveCloudflareCredential(input: {
  userId: string;
  credential: CloudflareCredential;
  environment?: Record<string, string | undefined>;
  db?: CredentialDatabase;
}): Promise<void> {
  const db = input.db ?? tenantDb(input.userId);
  const encryptedApiToken = encryptProviderToken({
    apiToken: input.credential.apiToken,
    userId: input.userId,
    encryptionKey: encryptionKey(input.environment),
  });
  const now = new Date().toISOString();
  try {
    await db
      .insertInto("agent_provider_credentials")
      .values({
        user_id: input.userId,
        provider: CLOUDFLARE_PROVIDER,
        account_id: input.credential.accountId,
        encrypted_api_token: encryptedApiToken,
        updated_at: now,
      })
      .onConflict((conflict) => conflict.columns(["user_id", "provider"]).doUpdateSet({
        account_id: input.credential.accountId,
        encrypted_api_token: encryptedApiToken,
        updated_at: now,
      }))
      .execute();
  } catch (error) {
    throw new Error("Could not save provider connection.", { cause: error });
  }
}

export async function loadCloudflareCredential(input: {
  userId: string;
  environment?: Record<string, string | undefined>;
  db?: CredentialDatabase;
}): Promise<CloudflareCredential | null> {
  const db = input.db ?? tenantDb(input.userId);
  let data: { account_id: string; encrypted_api_token: string } | undefined;
  try {
    data = await db
      .selectFrom("agent_provider_credentials")
      .select(["account_id", "encrypted_api_token"])
      .where("user_id", "=", input.userId)
      .where("provider", "=", CLOUDFLARE_PROVIDER)
      .executeTakeFirst();
  } catch (error) {
    throw new Error("Could not load provider connection.", { cause: error });
  }
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
  db: CredentialDatabase = tenantDb(userId),
): Promise<void> {
  try {
    await db
      .deleteFrom("agent_provider_credentials")
      .where("provider", "=", CLOUDFLARE_PROVIDER)
      .where("user_id", "=", userId)
      .execute();
  } catch (error) {
    throw new Error("Could not remove provider connection.", { cause: error });
  }
}

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

import {
  normalizeCloudflareAccountId,
  normalizeCloudflareApiToken,
} from "@/lib/agent/provider-config";

const CIPHER = "aes-256-gcm";
const CREDENTIAL_VERSION = "v1";

type CredentialInput = {
  accountId?: unknown;
  apiToken?: unknown;
};

function decodeEncryptionKey(value: string): Buffer {
  let key: Buffer;
  try {
    key = Buffer.from(value, "base64");
  } catch {
    key = Buffer.alloc(0);
  }
  if (key.length !== 32) {
    throw new Error("LOCUS_CREDENTIAL_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  }
  return key;
}

function authenticatedContext(userId: string): Buffer {
  if (!userId || userId.length > 255) throw new Error("A valid credential owner is required.");
  return Buffer.from(`locus:cloudflare-workers-ai:${userId}`, "utf8");
}

export function parseCloudflareCredentialInput(input: CredentialInput): {
  accountId: string;
  apiToken: string;
} {
  if (typeof input.accountId !== "string") {
    throw new Error("Cloudflare Account ID is required.");
  }
  if (typeof input.apiToken !== "string") {
    throw new Error("Cloudflare API token is required.");
  }
  const accountId = normalizeCloudflareAccountId(input.accountId);
  const apiToken = normalizeCloudflareApiToken(input.apiToken);
  return { accountId, apiToken };
}

export function encryptProviderToken(input: {
  apiToken: string;
  userId: string;
  encryptionKey: string;
}): string {
  const key = decodeEncryptionKey(input.encryptionKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv(CIPHER, key, iv);
  cipher.setAAD(authenticatedContext(input.userId));
  const ciphertext = Buffer.concat([
    cipher.update(input.apiToken, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    CREDENTIAL_VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptProviderToken(input: {
  encrypted: string;
  userId: string;
  encryptionKey: string;
}): string {
  const [version, ivValue, tagValue, ciphertextValue, extra] = input.encrypted.split(".");
  if (
    version !== CREDENTIAL_VERSION
    || !ivValue
    || !tagValue
    || !ciphertextValue
    || extra !== undefined
  ) {
    throw new Error("Stored provider credential has an unsupported format.");
  }
  const key = decodeEncryptionKey(input.encryptionKey);
  const decipher = createDecipheriv(CIPHER, key, Buffer.from(ivValue, "base64url"));
  decipher.setAAD(authenticatedContext(input.userId));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

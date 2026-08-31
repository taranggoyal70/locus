import { describe, expect, it } from "vitest";

import {
  decryptProviderToken,
  encryptProviderToken,
  parseCloudflareCredentialInput,
} from "@/lib/agent/provider-credential";

const encryptionKey = Buffer.alloc(32, 7).toString("base64");

describe("user-owned provider credentials", () => {
  it("encrypts an API token with user-bound authenticated encryption", () => {
    const encrypted = encryptProviderToken({
      apiToken: "secret-cloudflare-api-token",
      userId: "user-owner",
      encryptionKey,
    });

    expect(encrypted).not.toContain("secret-cloudflare-api-token");
    expect(decryptProviderToken({
      encrypted,
      userId: "user-owner",
      encryptionKey,
    })).toBe("secret-cloudflare-api-token");
    expect(() => decryptProviderToken({
      encrypted,
      userId: "user-other",
      encryptionKey,
    })).toThrow();
  });

  it("rejects malformed account ids, tokens, and encryption keys", () => {
    expect(() => parseCloudflareCredentialInput({
      accountId: "not-an-account",
      apiToken: "short",
    })).toThrow("Cloudflare Account ID");
    expect(() => encryptProviderToken({
      apiToken: "secret-cloudflare-api-token",
      userId: "user-owner",
      encryptionKey: "not-a-key",
    })).toThrow("32-byte");
  });

  it("normalizes a valid Cloudflare credential without logging or echo helpers", () => {
    expect(parseCloudflareCredentialInput({
      accountId: " ABCDEF0123456789ABCDEF0123456789 ",
      apiToken: "  cloudflare-token-that-is-long-enough  ",
    })).toEqual({
      accountId: "abcdef0123456789abcdef0123456789",
      apiToken: "cloudflare-token-that-is-long-enough",
    });
  });
});

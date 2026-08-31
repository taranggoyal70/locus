import { describe, expect, it } from "vitest";

import {
  CLOUDFLARE_AGENT_MODEL,
  cloudflareOpenAIBaseUrl,
  providerCapacityKey,
  resolveSharedCloudflareCredential,
} from "@/lib/agent/provider-config";

describe("Cloudflare Agent provider configuration", () => {
  it("resolves only the reviewed shared model and credential pair", () => {
    expect(resolveSharedCloudflareCredential({
      CLOUDFLARE_ACCOUNT_ID: "0123456789abcdef0123456789abcdef",
      CLOUDFLARE_API_TOKEN: "cloudflare-token-that-is-long-enough",
      LOCUS_AGENT_MODEL: CLOUDFLARE_AGENT_MODEL,
    })).toEqual({
      accountId: "0123456789abcdef0123456789abcdef",
      apiToken: "cloudflare-token-that-is-long-enough",
    });

    expect(() => resolveSharedCloudflareCredential({
      CLOUDFLARE_ACCOUNT_ID: "0123456789abcdef0123456789abcdef",
      CLOUDFLARE_API_TOKEN: "cloudflare-token-that-is-long-enough",
      LOCUS_AGENT_MODEL: "openai/gpt-5.6-sol",
    })).toThrow("reviewed Cloudflare model");
  });

  it("builds a fixed Cloudflare API origin from a validated account id", () => {
    expect(cloudflareOpenAIBaseUrl("0123456789abcdef0123456789abcdef")).toBe(
      "https://api.cloudflare.com/client/v4/accounts/0123456789abcdef0123456789abcdef/ai/v1",
    );
    expect(() => cloudflareOpenAIBaseUrl("../../attacker.example")).toThrow(
      "Cloudflare Account ID",
    );
  });

  it("separates shared capacity from each user's own provider capacity", () => {
    expect(providerCapacityKey({ executionMode: "shared", userId: "user-a" })).toBe(
      "cloudflare-workers-ai:shared",
    );
    expect(providerCapacityKey({ executionMode: "byok", userId: "user-a" })).toBe(
      "cloudflare-workers-ai:byok:user-a",
    );
    expect(providerCapacityKey({ executionMode: "byok", userId: "user-b" })).not.toBe(
      providerCapacityKey({ executionMode: "byok", userId: "user-a" }),
    );
  });
});

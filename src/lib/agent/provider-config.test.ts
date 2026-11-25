import { describe, expect, it } from "vitest";

import {
  CLOUDFLARE_AGENT_MODEL,
  cloudflareOpenAIBaseUrl,
  isDeploymentOwner,
  providerCapacityKey,
  resolveSharedCloudflareCredential,
  resolveSharedDailyRunLimit,
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

  it("keeps the shared daily ceiling at one unless a valid limit is configured", () => {
    expect(resolveSharedDailyRunLimit({})).toBe(1);
    expect(resolveSharedDailyRunLimit({ LOCUS_SHARED_DAILY_RUN_LIMIT: " " })).toBe(1);
    expect(resolveSharedDailyRunLimit({ LOCUS_SHARED_DAILY_RUN_LIMIT: "5" })).toBe(5);
    expect(resolveSharedDailyRunLimit({ LOCUS_SHARED_DAILY_RUN_LIMIT: "100" })).toBe(100);
    for (const bad of ["0", "101", "2.5", "-1", "five", "1e2"]) {
      expect(() => resolveSharedDailyRunLimit({ LOCUS_SHARED_DAILY_RUN_LIMIT: bad }), bad)
        .toThrow("LOCUS_SHARED_DAILY_RUN_LIMIT");
    }
  });

  it("recognizes only exact owner ids from the comma-separated list", () => {
    const environment = { LOCUS_OWNER_USER_IDS: " user_owner, user_second ,," };
    expect(isDeploymentOwner("user_owner", environment)).toBe(true);
    expect(isDeploymentOwner("user_second", environment)).toBe(true);
    expect(isDeploymentOwner("user_own", environment)).toBe(false);
    expect(isDeploymentOwner("", environment)).toBe(false);
    expect(isDeploymentOwner("user_owner", {})).toBe(false);
  });
});

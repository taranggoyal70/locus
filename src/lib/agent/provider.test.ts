import { describe, expect, it } from "vitest";

import { createCloudflareAgentModel } from "@/lib/agent/provider";

describe("direct Cloudflare language model", () => {
  it("pins the reviewed model on the fixed Cloudflare API origin", () => {
    const model = createCloudflareAgentModel({
      accountId: "0123456789abcdef0123456789abcdef",
      apiToken: "cloudflare-token-that-is-long-enough",
    });

    expect(model.provider).toBe("cloudflare-workers-ai.chat");
    expect(model.modelId).toBe("@cf/qwen/qwen3.8-27b");
  });
});

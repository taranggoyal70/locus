import { describe, expect, it } from "vitest";
import { generateApiKey, hashKey } from "./api-auth";

describe("generateApiKey", () => {
  it("starts with the lk_ prefix", () => {
    const key = generateApiKey();
    expect(key.startsWith("lk_")).toBe(true);
  });

  it("generates 64 hex characters after the prefix", () => {
    const key = generateApiKey();
    const raw = key.slice(3);
    expect(raw).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates unique keys", () => {
    const keys = new Set(Array.from({ length: 10 }, () => generateApiKey()));
    expect(keys.size).toBe(10);
  });
});

describe("hashKey", () => {
  it("returns a 64-char hex string", async () => {
    const hash = await hashKey("lk_abc123");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic", async () => {
    const a = await hashKey("lk_test");
    const b = await hashKey("lk_test");
    expect(a).toBe(b);
  });

  it("differs for different inputs", async () => {
    const a = await hashKey("lk_alpha");
    const b = await hashKey("lk_beta");
    expect(a).not.toBe(b);
  });
});

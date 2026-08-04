import { describe, expect, it } from "vitest";

import { readLimitedJson, sameOriginMutation } from "@/lib/request-security";

describe("cookie-authenticated mutation guards", () => {
  it("rejects cross-origin and cross-site browser mutations", () => {
    expect(sameOriginMutation(new Request("https://locus.example/api/test", {
      method: "POST",
      headers: { origin: "https://attacker.example" },
    }))).toBe(false);
    expect(sameOriginMutation(new Request("https://locus.example/api/test", {
      method: "POST",
      headers: { "sec-fetch-site": "cross-site" },
    }))).toBe(false);
  });

  it("allows same-origin and non-browser requests", () => {
    expect(sameOriginMutation(new Request("https://locus.example/api/test", {
      method: "POST",
      headers: { origin: "https://locus.example", "sec-fetch-site": "same-origin" },
    }))).toBe(true);
    expect(sameOriginMutation(new Request("https://locus.example/api/test", { method: "POST" }))).toBe(true);
  });

  it("caps streamed JSON bodies before parsing", async () => {
    const result = await readLimitedJson(new Request("https://locus.example/api/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value: "x".repeat(200) }),
    }), 64);

    expect(result).toEqual({ ok: false, status: 413, error: "Request body is too large." });
  });
});

import { describe, expect, it } from "vitest";

import { securityHeaders } from "@/lib/security-headers";

// R16: nothing asserted these while they lived inline in next.config.ts, so a
// header dropped during an unrelated edit would weaken the browser surface
// with no signal. These tests are the signal.

describe("security headers", () => {
  const byKey = new Map(securityHeaders.map((header) => [header.key, header.value]));

  it.each([
    ["X-Frame-Options", "DENY"],
    ["X-Content-Type-Options", "nosniff"],
    ["Referrer-Policy", "strict-origin-when-cross-origin"],
    ["Permissions-Policy", "camera=(), microphone=(), geolocation=(), usb=()"],
    ["Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload"],
  ])("pins %s", (key, value) => {
    expect(byKey.get(key)).toBe(value);
  });

  it("does not weaken frame protection to a permissive value", () => {
    expect(byKey.get("X-Frame-Options")).not.toMatch(/allow|sameorigin/i);
  });

  it("keeps HSTS at two years with subdomains and preload", () => {
    const hsts = byKey.get("Strict-Transport-Security") ?? "";
    const maxAge = Number(/max-age=(\d+)/.exec(hsts)?.[1] ?? 0);

    expect(maxAge).toBeGreaterThanOrEqual(63_072_000);
    expect(hsts).toContain("includeSubDomains");
    expect(hsts).toContain("preload");
  });

  it("does not leak full URLs to third-party origins", () => {
    expect(byKey.get("Referrer-Policy")).not.toBe("unsafe-url");
    expect(byKey.get("Referrer-Policy")).not.toBe("no-referrer-when-downgrade");
  });

  it("declares no duplicate header keys", () => {
    expect(byKey.size).toBe(securityHeaders.length);
  });
});

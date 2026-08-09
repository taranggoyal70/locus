import { describe, expect, it } from "vitest";

import { createLogEntry, redactSecrets } from "@/lib/logger";

describe("structured operational logging", () => {
  it("emits stable events with bounded correlation and redacted sensitive context", () => {
    expect(createLogEntry("error", "agent.run.failed", {
      correlationId: "00000000-0000-4000-8000-000000000001",
      context: {
        failureKind: "quota_exhausted",
        authorization: "Bearer secret",
        nested: { apiKey: "secret", count: 2 },
      },
    })).toMatchObject({
      level: "error",
      event: "agent.run.failed",
      correlationId: "00000000-0000-4000-8000-000000000001",
      context: {
        failureKind: "quota_exhausted",
        authorization: "[REDACTED]",
        nested: { apiKey: "[REDACTED]", count: 2 },
      },
    });
  });

  it("drops unbounded correlation identifiers", () => {
    expect(createLogEntry("warn", "agent.run.warning", {
      correlationId: "x".repeat(300),
    }).correlationId).toBeNull();
  });
});

// R15: redaction was keyed on field names, which only protects credentials
// that arrive under a name someone thought of. The realistic leak is a secret
// embedded in a value under an innocent key: an error message quoting the
// failing request, a stack trace, a URL carrying a token.

describe("secret redaction by value shape", () => {
  it.each([
    ["Locus API key", "request failed for lk_live_9f2c4a7b81d3e6", "lk_live_9f2c4a7b81d3e6"],
    ["Stripe secret key", "stripe error: sk_live_51H8xKjA9bQ2mZ", "sk_live_51H8xKjA9bQ2mZ"],
    ["Stripe webhook secret", "verify against whsec_7GkPq2Lm9Xr4Tz", "whsec_7GkPq2Lm9Xr4Tz"],
    ["GitHub token", "clone failed ghp_16C7e42F292c6912E7710c8", "ghp_16C7e42F292c6912E7710c8"],
    ["GitHub fine-grained PAT", "github_pat_11ABCDEFG0abcdefghij", "github_pat_11ABCDEFG0abcdefghij"],
    ["Supabase key", "sbp_0102030405060708090a0b0c0d", "sbp_0102030405060708090a0b0c0d"],
    ["AWS access key id", "using AKIAIOSFODNN7EXAMPLE now", "AKIAIOSFODNN7EXAMPLE"],
    [
      "JWT",
      "token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K",
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K",
    ],
  ])("removes a %s embedded in a message", (_label, message, secret) => {
    const output = redactSecrets(message);

    expect(output).not.toContain(secret);
    expect(output).toContain("[REDACTED]");
  });

  it("keeps the scheme so the log still shows a credential was presented", () => {
    expect(redactSecrets("header: Bearer lk_live_9f2c4a7b81d3e6")).toBe(
      "header: Bearer [REDACTED]",
    );
    expect(redactSecrets("header: Basic dXNlcjpwYXNzd29yZA==")).toBe("header: Basic [REDACTED]");
  });

  it("removes every occurrence, not just the first", () => {
    const output = redactSecrets("lk_aaaaaaaaaaaa then lk_bbbbbbbbbbbb");

    expect(output).not.toContain("lk_aaaaaaaaaaaa");
    expect(output).not.toContain("lk_bbbbbbbbbbbb");
  });

  // Global regexes carry lastIndex between calls, which would make redaction
  // silently skip matches on alternate invocations.
  it("does not leak regex state across calls", () => {
    const message = "key lk_aaaaaaaaaaaa";

    expect(redactSecrets(message)).toBe(redactSecrets(message));
    expect(redactSecrets(message)).not.toContain("lk_aaaaaaaaaaaa");
  });

  // A "long random-looking string" rule would redact these and make the logs
  // useless for the incident response they exist to support.
  it.each([
    "commit 4b671b8f3a2c9d1e5f7a8b9c0d1e2f3a4b5c6d7e",
    "run_019fd8f8-1234-4321-abcd-0123456789ab",
    "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  ])("leaves ordinary identifiers alone: %s", (text) => {
    expect(redactSecrets(text)).toBe(text);
  });
});

describe("log entry sanitisation", () => {
  it("redacts a secret hidden under an innocent field name", () => {
    const entry = createLogEntry("error", "agent.run.failed", {
      context: { message: "POST /v1/locate failed with Bearer lk_live_9f2c4a7b81d3e6" },
    });

    expect(JSON.stringify(entry)).not.toContain("lk_live_9f2c4a7b81d3e6");
  });

  it("still redacts by field name", () => {
    const entry = createLogEntry("info", "request", {
      context: { authorization: "anything at all" },
    });

    expect((entry.context as Record<string, unknown>).authorization).toBe("[REDACTED]");
  });

  it("redacts nested values", () => {
    const entry = createLogEntry("error", "delivery.failed", {
      context: { detail: { cause: { note: "used ghp_16C7e42F292c6912E7710c8" } } },
    });

    expect(JSON.stringify(entry)).not.toContain("ghp_16C7e42F292c6912E7710c8");
  });

  // Redaction runs before truncation, so a secret straddling the 1,000
  // character boundary cannot survive as a usable prefix.
  it("redacts before truncating", () => {
    const entry = createLogEntry("error", "long", {
      context: { message: `${"x".repeat(990)}lk_live_9f2c4a7b81d3e6` },
    });

    expect(JSON.stringify(entry)).not.toContain("lk_live_9f2");
  });
});

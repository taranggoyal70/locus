import { describe, expect, it } from "vitest";

import { createLogEntry } from "@/lib/logger";

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

import { describe, expect, it } from "vitest";

import { ALLOWED_EVENTS, filterEventProperties, isAllowedEvent } from "@/lib/analytics-events";

describe("analytics property filtering", () => {
  it("keeps the properties the real producers send", () => {
    // These are the exact payloads emitted by TokenMeter.tsx. A schema that
    // dropped any of them would silently degrade the metrics it protects.
    expect(filterEventProperties("context_copied", { format: "claude", files: 12, tokens: 3400 })).toEqual({
      format: "claude",
      files: 12,
      tokens: 3400,
    });
    expect(
      filterEventProperties("context_copied", { format: "generic", files: 3, tokens: 90, method: "download" }),
    ).toEqual({ format: "generic", files: 3, tokens: 90, method: "download" });
    expect(
      filterEventProperties("context_feedback", { rating: "down", files: 4, includedTokens: 10, totalTokens: 99 }),
    ).toEqual({ rating: "down", files: 4, includedTokens: 10, totalTokens: 99 });
  });

  it("drops undeclared keys, so user text cannot reach the events table", () => {
    const filtered = filterEventProperties("context_copied", {
      format: "claude",
      task: "fix the login bug for acme corp",
      repo: "/Users/someone/private-work",
      notes: { nested: "also user words" },
    });

    expect(filtered).toEqual({ format: "claude" });
  });

  it("drops a declared key whose value is the wrong shape", () => {
    expect(filterEventProperties("context_copied", { files: "quite a lot", tokens: 5 })).toEqual({ tokens: 5 });
  });

  it("drops a string that is not one of the declared values", () => {
    expect(filterEventProperties("context_copied", { format: "the format I typed myself" })).toEqual({});
    expect(filterEventProperties("context_feedback", { rating: "sideways" })).toEqual({});
  });

  it("drops non-finite numbers that JSON round-tripping would mangle", () => {
    expect(filterEventProperties("context_copied", { tokens: Number.NaN })).toEqual({});
    expect(filterEventProperties("context_copied", { tokens: Number.POSITIVE_INFINITY })).toEqual({});
  });

  it("records nothing for an allowed event with no declared properties", () => {
    expect(isAllowedEvent("task_analyzed")).toBe(true);
    expect(filterEventProperties("task_analyzed", { anything: "at all", count: 3 })).toEqual({});
  });

  it("returns an empty object for an unknown event", () => {
    expect(isAllowedEvent("arbitrary_event")).toBe(false);
    expect(filterEventProperties("arbitrary_event", { files: 1 })).toEqual({});
  });

  it("returns an empty object for a payload that is not a plain object", () => {
    for (const raw of [undefined, null, "string", 7, [{ files: 1 }]]) {
      expect(filterEventProperties("context_copied", raw)).toEqual({});
    }
  });

  it("ignores inherited keys rather than reading up the prototype chain", () => {
    const raw = Object.create({ format: "claude" }) as Record<string, unknown>;
    raw.files = 2;

    expect(filterEventProperties("context_copied", raw)).toEqual({ files: 2 });
  });

  it("exposes the allowlist the route validates against", () => {
    expect([...ALLOWED_EVENTS].sort()).toEqual(
      ["context_copied", "context_feedback", "project_saved", "task_analyzed"].sort(),
    );
  });
});

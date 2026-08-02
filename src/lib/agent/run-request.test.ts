import { describe, expect, it } from "vitest";

import { parseAgentRunRequest } from "@/lib/agent/run-request";

describe("agent run request", () => {
  it("normalizes a valid run request", () => {
    expect(
      parseAgentRunRequest({
        repository: " taranggoyal70/locus ",
        task: " Fix the settings save flow ",
        acceptanceCriteria: ["Persists after refresh", "Tests pass"],
      }),
    ).toEqual({
      repository: "taranggoyal70/locus",
      baseRef: "main",
      task: "Fix the settings save flow",
      acceptanceCriteria: ["Persists after refresh", "Tests pass"],
    });
  });

  it("rejects vague or oversized execution requests", () => {
    expect(() => parseAgentRunRequest({ repository: "a/b", task: "fix" })).toThrow(
      "Describe the task in at least 10 characters",
    );
    expect(() =>
      parseAgentRunRequest({
        repository: "a/b",
        task: "Implement a complete fix",
        acceptanceCriteria: Array.from({ length: 13 }, (_, index) => `Criterion ${index}`),
      }),
    ).toThrow("No more than 12 acceptance criteria");
  });

  it("keeps the revision selected during repository intake", () => {
    expect(
      parseAgentRunRequest({
        repository: "acme/widgets@feature/token-ledger",
        task: "Make the token ledger status-aware",
      }),
    ).toMatchObject({ repository: "acme/widgets", baseRef: "feature/token-ledger" });

    expect(
      parseAgentRunRequest({
        repository: "https://github.com/acme/widgets/tree/release/beta",
        task: "Prepare the public beta release",
      }),
    ).toMatchObject({ repository: "acme/widgets", baseRef: "release/beta" });
  });
});

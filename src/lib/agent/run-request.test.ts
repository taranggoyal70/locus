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
});

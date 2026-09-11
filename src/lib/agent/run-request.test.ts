import { describe, expect, it } from "vitest";

import {
  CONTROLLED_ALPHA_DATA_POLICY_VERSION,
  parseAgentRunRequest,
} from "@/lib/agent/run-request";

describe("agent run request", () => {
  it("normalizes a valid run request", () => {
    expect(
      parseAgentRunRequest({
        repository: " taranggoyal70/locus ",
        task: " Fix the settings save flow ",
        executionMode: "byok",
        acceptanceCriteria: ["Persists after refresh", "Tests pass"],
        dataPolicyAcceptance: { version: CONTROLLED_ALPHA_DATA_POLICY_VERSION },
      }),
    ).toEqual({
      repository: "taranggoyal70/locus",
      baseRef: "main",
      task: "Fix the settings save flow",
      executionMode: "byok",
      acceptanceCriteria: ["Persists after refresh", "Tests pass"],
      workflowId: null,
      dataPolicyVersion: CONTROLLED_ALPHA_DATA_POLICY_VERSION,
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
        dataPolicyAcceptance: { version: CONTROLLED_ALPHA_DATA_POLICY_VERSION },
      }),
    ).toMatchObject({ repository: "acme/widgets", baseRef: "feature/token-ledger" });

    expect(
      parseAgentRunRequest({
        repository: "https://github.com/acme/widgets/tree/release/beta",
        task: "Prepare the public beta release",
        dataPolicyAcceptance: { version: CONTROLLED_ALPHA_DATA_POLICY_VERSION },
      }),
    ).toMatchObject({ repository: "acme/widgets", baseRef: "release/beta" });
  });

  it("requires explicit acknowledgement of the free-tier data boundary", () => {
    expect(() => parseAgentRunRequest({
      repository: "acme/widgets",
      task: "Prepare a review-ready proposal",
      dataPolicyAcceptance: { version: "outdated-policy" },
    })).toThrow("Confirm the early-access data policy before starting an Agent Run");
  });

  it("defaults to shared capacity and rejects unknown execution modes", () => {
    expect(parseAgentRunRequest({
      repository: "acme/widgets",
      task: "Prepare a review-ready proposal",
      dataPolicyAcceptance: { version: CONTROLLED_ALPHA_DATA_POLICY_VERSION },
    })).toMatchObject({ executionMode: "shared" });

    expect(() => parseAgentRunRequest({
      repository: "acme/widgets",
      task: "Prepare a review-ready proposal",
      executionMode: "fastest-provider",
      dataPolicyAcceptance: { version: CONTROLLED_ALPHA_DATA_POLICY_VERSION },
    })).toThrow("Execution mode must be shared or byok");
  });
});

// R16: a workflow-driven Run, end to end through the request parser. The point
// of a template is that the task text and criteria come from code rather than
// from whatever the operator typed this time.
describe("workflow-driven Agent Run requests", () => {
  const base = {
    repository: "owner/repo",
    dataPolicyAcceptance: { version: CONTROLLED_ALPHA_DATA_POLICY_VERSION },
  };

  it("builds task and criteria from the template", () => {
    const parsed = parseAgentRunRequest({
      ...base,
      workflow: {
        id: "api-migration",
        values: {
          fromApi: "createClient(url, key)",
          toApi: "createClient({ url, key })",
          rationale: "the positional signature is removed in v3",
        },
      },
    });

    expect(parsed.workflowId).toBe("api-migration");
    expect(parsed.task).toContain("createClient(url, key)");
    expect(parsed.acceptanceCriteria.length).toBeGreaterThan(0);
  });

  it("leaves a free-text Run with no workflow id", () => {
    const parsed = parseAgentRunRequest({
      ...base,
      task: "fix the retry path in billing",
    });
    expect(parsed.workflowId).toBeNull();
  });

  // Silently preferring one over the other would surprise whoever sent both.
  it("refuses a request carrying both a workflow and a task", () => {
    expect(() => parseAgentRunRequest({
      ...base,
      task: "something else entirely",
      workflow: { id: "api-migration", values: { fromApi: "a()", toApi: "b()", rationale: "why" } },
    })).toThrow(/not both/);
  });

  it("refuses acceptance criteria alongside a workflow that supplies its own", () => {
    expect(() => parseAgentRunRequest({
      ...base,
      acceptanceCriteria: ["my own criterion"],
      workflow: { id: "api-migration", values: { fromApi: "a()", toApi: "b()", rationale: "why" } },
    })).toThrow(/supplies its own/);
  });

  it("surfaces the template's own validation message", () => {
    expect(() => parseAgentRunRequest({
      ...base,
      workflow: { id: "api-migration", values: { toApi: "b()", rationale: "why" } },
    })).toThrow(/Current API is required/);
  });

  it("refuses a non-text parameter value", () => {
    expect(() => parseAgentRunRequest({
      ...base,
      workflow: { id: "api-migration", values: { fromApi: 42 } },
    })).toThrow(/workflow.values.fromApi must be text/);
  });

  it("refuses a workflow selection with no id", () => {
    expect(() => parseAgentRunRequest({ ...base, workflow: { values: {} } }))
      .toThrow(/workflow.id is required/);
  });
});

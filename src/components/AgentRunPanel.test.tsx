import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AgentRunPanel, AgentRunTimeline } from "@/components/AgentRunPanel";

describe("AgentRunTimeline", () => {
  it("renders the complete execution lifecycle and current phase", () => {
    const html = renderToStaticMarkup(
      <AgentRunTimeline
        status="executing"
        steps={[
          {
            id: 1,
            sequence: 0,
            title: "Context Slice selected",
            status: "completed",
            detail: {},
          },
        ]}
      />,
    );

    expect(html).toContain("Locate");
    expect(html).toContain("Prepare");
    expect(html).toContain("Implement");
    expect(html).toContain("Verify");
    expect(html).toContain("Review");
    expect(html).not.toContain("Approve");
    expect(html).toContain("Context Slice selected");
    expect(html).toContain("Working");
  });

  it("renders review-ready Runs as quiescent", () => {
    const html = renderToStaticMarkup(<AgentRunTimeline status="awaiting_approval" steps={[]} />);

    expect(html).toContain("Review");
    expect(html).not.toContain("Review · Working");
  });
});

describe("controlled-alpha Agent Run start", () => {
  it("requires the Gateway data acknowledgement before launch", () => {
    const html = renderToStaticMarkup(
      <AgentRunPanel
        repository="taranggoyal70/locus"
        task="Fix the controlled alpha evidence contract"
        sliceCount={4}
        excludedCount={8}
        acceptanceCriteria={["The evidence contract is factual"]}
        runAccess={{ canStart: true, tier: "partner", reason: "partner_allowlist", quota: { maxActiveRuns: 2, maxDailyRuns: 10 }, usage: null }}
      />,
    );

    expect(html).toContain("processed by OpenAI through Vercel AI Gateway");
    expect(html).toContain("prompt training disabled");
    expect(html).toContain("private, confidential, or personal data");
    expect(html).toMatch(/<button[^>]*disabled/);
  });

  it("explains a waitlisted refusal without promising an invitation", () => {
    const html = renderToStaticMarkup(
      <AgentRunPanel
        repository="taranggoyal70/locus"
        task="Fix the controlled alpha evidence contract"
        sliceCount={4}
        excludedCount={8}
        acceptanceCriteria={["The evidence contract is factual"]}
        runAccess={{ canStart: false, tier: "visitor", reason: "waitlist", quota: { maxActiveRuns: 0, maxDailyRuns: 0 }, usage: null }}
      />,
    );

    expect(html).toContain("Request access");
    expect(html).toContain("opening in batches");
    // The old copy told every refused account it needed an invitation, which
    // read as "you are next in line" to a suspended user and as a dead end to a
    // waitlisted one.
    expect(html).not.toContain("Invite required");
    expect(html).not.toContain("verified saved");
    expect(html).not.toContain("−60%");
  });

  it("tells a suspended account to contact support instead of to wait", () => {
    const html = renderToStaticMarkup(
      <AgentRunPanel
        repository="taranggoyal70/locus"
        task="Fix the controlled alpha evidence contract"
        sliceCount={4}
        excludedCount={8}
        acceptanceCriteria={["The evidence contract is factual"]}
        runAccess={{ canStart: false, tier: "visitor", reason: "suspended", quota: { maxActiveRuns: 0, maxDailyRuns: 0 }, usage: null }}
      />,
    );

    expect(html).toContain("Contact support");
    expect(html).not.toContain("opening in batches");
    expect(html).toContain('href="/support"');
  });

  it("gives a waitlisted account a control that goes somewhere", () => {
    const html = renderToStaticMarkup(
      <AgentRunPanel
        repository="taranggoyal70/locus"
        task="Fix the controlled alpha evidence contract"
        sliceCount={4}
        excludedCount={8}
        acceptanceCriteria={["The evidence contract is factual"]}
        runAccess={{ canStart: false, tier: "visitor", reason: "waitlist", quota: { maxActiveRuns: 0, maxDailyRuns: 0 }, usage: null }}
      />,
    );

    // Previously this rendered "Request access" on a disabled button: an action
    // label with no action behind it.
    expect(html).toContain('href="/pricing#request-access"');
    expect(html).not.toContain("disabled");
  });

  it("states the plan allowance to an account that can run", () => {
    const html = renderToStaticMarkup(
      <AgentRunPanel
        repository="taranggoyal70/locus"
        task="Fix the controlled alpha evidence contract"
        sliceCount={4}
        excludedCount={8}
        acceptanceCriteria={["The evidence contract is factual"]}
        runAccess={{ canStart: true, tier: "free", reason: "self_serve", quota: { maxActiveRuns: 1, maxDailyRuns: 3 }, usage: null }}
      />,
    );

    expect(html).toContain("3 Agent Runs per day");
  });
});

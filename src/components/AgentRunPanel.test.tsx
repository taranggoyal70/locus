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
        runAccess={{ canStart: true, tier: "partner", reason: "partner_allowlist", quota: { maxActiveRuns: 2, maxDailyRuns: 10 } }}
      />,
    );

    expect(html).toContain("processed by OpenAI through Vercel AI Gateway");
    expect(html).toContain("prompt training disabled");
    expect(html).toContain("private, confidential, or personal data");
    expect(html).toMatch(/<button[^>]*disabled/);
  });

  it("shows a disabled invite state outside the allowlist", () => {
    const html = renderToStaticMarkup(
      <AgentRunPanel
        repository="taranggoyal70/locus"
        task="Fix the controlled alpha evidence contract"
        sliceCount={4}
        excludedCount={8}
        acceptanceCriteria={["The evidence contract is factual"]}
        runAccess={{ canStart: false, tier: "visitor", reason: "waitlist", quota: { maxActiveRuns: 0, maxDailyRuns: 0 } }}
      />,
    );

    expect(html).toContain("Invite required");
    expect(html).toContain("available only to invited design partners");
    expect(html).not.toContain("verified saved");
    expect(html).not.toContain("−60%");
  });
});

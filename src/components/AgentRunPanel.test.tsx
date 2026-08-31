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
  it("explains shared and user-owned capacity before launch", () => {
    const html = renderToStaticMarkup(
      <AgentRunPanel
        repository="taranggoyal70/locus"
        task="Fix the controlled alpha evidence contract"
        sliceCount={4}
        excludedCount={8}
        acceptanceCriteria={["The evidence contract is factual"]}
        canStartRun
      />,
    );

    expect(html).toContain("Use the shared beta Run");
    expect(html).toContain("One substantial Run per UTC day across Locus");
    expect(html).toContain("Use my Cloudflare account");
    expect(html).toContain("processed by Cloudflare Workers AI");
    expect(html).toContain("private, confidential, or personal data");
    expect(html).toMatch(/<button[^>]*disabled/);
  });

  it("shows a disabled beta state when Run starts are closed", () => {
    const html = renderToStaticMarkup(
      <AgentRunPanel
        repository="taranggoyal70/locus"
        task="Fix the controlled alpha evidence contract"
        sliceCount={4}
        excludedCount={8}
        acceptanceCriteria={["The evidence contract is factual"]}
        canStartRun={false}
      />,
    );

    expect(html).toContain("Beta access required");
    expect(html).toContain("Agent Run starts are currently closed");
    expect(html).not.toContain("verified saved");
    expect(html).not.toContain("−60%");
  });
});

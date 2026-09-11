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
        runAccess={{ canStart: true, tier: "partner", reason: "partner_allowlist", quota: { maxActiveRuns: 2, maxRunsPerRolling24Hours: 10 }, usage: null }}
      />,
    );

    expect(html).toContain("Use the shared beta Run");
    expect(html).toContain("One substantial Run per UTC day across Locus");
    expect(html).toContain("Use my Cloudflare account");
    expect(html).toContain("processed by Cloudflare Workers AI");
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
        runAccess={{ canStart: false, tier: "visitor", reason: "waitlist", quota: { maxActiveRuns: 0, maxRunsPerRolling24Hours: 0 }, usage: null }}
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
        runAccess={{ canStart: false, tier: "visitor", reason: "suspended", quota: { maxActiveRuns: 0, maxRunsPerRolling24Hours: 0 }, usage: null }}
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
        runAccess={{ canStart: false, tier: "visitor", reason: "waitlist", quota: { maxActiveRuns: 0, maxRunsPerRolling24Hours: 0 }, usage: null }}
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
        runAccess={{ canStart: true, tier: "free", reason: "self_serve", quota: { maxActiveRuns: 1, maxRunsPerRolling24Hours: 2 }, usage: null }}
      />,
    );

    expect(html).toContain("2 Agent Runs per rolling 24 hours");
  });
});

describe("spent daily allowance", () => {
  function panel(usage: { activeRuns: number; runsInLast24Hours: number } | null) {
    return renderToStaticMarkup(
      <AgentRunPanel
        repository="taranggoyal70/locus"
        task="Fix the controlled alpha evidence contract"
        sliceCount={4}
        excludedCount={8}
        acceptanceCriteria={["The evidence contract is factual"]}
        runAccess={{
          canStart: true, tier: "free", reason: "self_serve",
          quota: { maxActiveRuns: 1, maxRunsPerRolling24Hours: 2 }, usage,
        }}
      />,
    );
  }

  it("stops asking for capacity and consent once the allowance is spent", () => {
    // The capability is still held, so the old markup kept rendering the
    // capacity chooser and the data-policy checkbox — inputs for a Run that
    // cannot start. Found by screenshotting the state rather than reading it.
    const html = panel({ activeRuns: 0, runsInLast24Hours: 2 });
    expect(html).toContain("Run allowance used");
    expect(html).not.toContain("Choose capacity");
    expect(html).not.toContain("I confirm this public Repo");
  });

  it("still offers both while the allowance remains", () => {
    const html = panel({ activeRuns: 0, runsInLast24Hours: 1 });
    expect(html).toContain("Choose capacity");
    expect(html).toContain("I confirm this public Repo");
    expect(html).toContain("1 of 2 Agent Runs left in your rolling 24 hour window");
  });

  it("offers them when usage could not be read at all", () => {
    // An unreadable count must not look like an exhausted allowance.
    const html = panel(null);
    expect(html).toContain("Choose capacity");
    expect(html).not.toContain("Run allowance used");
  });
});

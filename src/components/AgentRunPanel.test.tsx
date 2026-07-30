import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AgentRunTimeline } from "@/components/AgentRunPanel";

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
    expect(html).toContain("Plan");
    expect(html).toContain("Implement");
    expect(html).toContain("Verify");
    expect(html).toContain("Approve");
    expect(html).toContain("Context Slice selected");
    expect(html).toContain("Working");
  });
});

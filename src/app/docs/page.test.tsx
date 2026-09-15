import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import DocsPage from "@/app/docs/page";

describe("public beta documentation", () => {
  it("documents self-serve Agent Runs and unpublished runtime boundaries", () => {
    const html = renderToStaticMarkup(<DocsPage />);

    expect(html).toContain("Experimental localization API");
    expect(html).toContain("verified account can start an Agent Run");
    expect(html).toContain("one shared Run per UTC day");
    expect(html).toContain("own Cloudflare Workers AI account");
    expect(html).toContain("review-ready proposal");
    expect(html).toContain("does not currently publish a CLI");
    expect(html).toContain("context included by this localization response");
    expect(html).not.toContain("Invite-only Agent Runs");
    expect(html).not.toContain("open-source repository");
    expect(html).not.toContain("source-available");
    expect(html).not.toContain("source CLI");
    expect(html).not.toContain("savedPct");
    expect(html).not.toContain("npx locus-context");
    expect(html).not.toContain("approve loop");
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PricingPage from "@/app/pricing/page";

describe("public early-access access page", () => {
  it("offers one free design-partner program without paid or enterprise promises", () => {
    const html = renderToStaticMarkup(<PricingPage />);

    expect(html).toContain("Public early access");
    expect(html).toContain("Repo localization is open");
    // The canary condition moved from the H1 into the paragraph under it: as a
    // headline it ran to seven lines on a 390px viewport.
    expect(html).toContain("Agent Runs are invite-gated");
    expect(html).toContain("access-gated until the production canary passes");
    expect(html).toContain("Request Agent Run access");
    expect(html).toContain("Self-serve Repo localization");
    expect(html).toContain('id="request-access"');
    expect(html).toContain("Public JavaScript, TypeScript, and Python repositories");
    expect(html).not.toContain("$29");
    expect(html).not.toContain("Enterprise");
    expect(html).not.toContain("Private repositories");
    expect(html).not.toContain("SSO");
  });
});

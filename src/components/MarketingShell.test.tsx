import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MarketingShell } from "@/components/MarketingShell";

describe("controlled-alpha marketing navigation", () => {
  it("routes visitors to alpha access without commercial claims", () => {
    const html = renderToStaticMarkup(<MarketingShell><main>Content</main></MarketingShell>);

    expect(html).toContain("Alpha access");
    expect(html).toContain("Request access");
    expect(html).toContain('aria-label="Locus home"');
    expect(html).toContain("Public-Repo proposals with visible context evidence");
    expect(html).not.toContain("Pricing");
    expect(html).not.toContain("Verified engineering tasks");
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PricingPage from "@/app/pricing/page";

describe("public early-access access page", () => {
  it("offers one free design-partner program without paid or enterprise promises", () => {
    const html = renderToStaticMarkup(<PricingPage />);

    expect(html).toContain("Public early access");
    expect(html).toContain("Repo localization is open");
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

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MarketingShell } from "@/components/MarketingShell";

describe("public early-access marketing navigation", () => {
  it("routes visitors to the open product and Agent Run access without commercial claims", () => {
    const html = renderToStaticMarkup(<MarketingShell selfServeOpen={false}><main>Content</main></MarketingShell>);

    expect(html).toContain("Agent access");
    expect(html).toContain("Try Locus");
    expect(html).toContain('href="/demo"');
    expect(html).toContain('href="/evidence/release-1"');
    const signInLink = html.match(/<a[^>]*href="\/sign-in"[^>]*>Sign in<\/a>/)?.[0];
    expect(signInLink).toBeTruthy();
    expect(signInLink).not.toContain("hidden");
    expect(html).toContain('aria-label="Locus home"');
    expect(html).toContain("Public-Repo localization with visible context evidence");
    expect(html).not.toContain("Pricing");
    expect(html).not.toContain("Verified engineering tasks");
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PricingPage from "@/app/pricing/page";

describe("controlled-alpha access page", () => {
  it("offers one free design-partner program without paid or enterprise promises", () => {
    const html = renderToStaticMarkup(<PricingPage />);

    expect(html).toContain("Controlled alpha");
    expect(html).toContain("Free for invited design partners");
    expect(html).toContain("Request alpha access");
    expect(html).toContain("Public JavaScript and TypeScript repositories");
    expect(html).not.toContain("$29");
    expect(html).not.toContain("Enterprise");
    expect(html).not.toContain("Private repositories");
    expect(html).not.toContain("SSO");
  });
});

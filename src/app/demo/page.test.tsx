import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import DemoPage from "@/app/demo/page";

describe("API migration vision demo", () => {
  it("labels simulated and current capabilities without overstating the product", () => {
    const html = renderToStaticMarkup(<DemoPage />);

    expect(html).toContain("Interactive vision demo");
    expect(html).toContain("Fictional data · simulated sequence · no external writes");
    expect(html).toContain("This scenario shows the API-migration workflow Locus is validating—not a shipped or measured customer outcome.");
    expect(html).toContain("Real in early access today");
    expect(html).toContain("Being validated next");
    expect(html).toContain("Try the live Localizer");
    expect(html).not.toContain("customer-proven");
    expect(html).not.toContain("verified outcome");
  });
});

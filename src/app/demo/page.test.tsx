import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import DemoPage from "@/app/demo/page";

describe("API migration vision demo", () => {
  it("labels simulated and current capabilities without overstating the product", () => {
    const html = renderToStaticMarkup(<DemoPage />);

    expect(html).toContain("Interactive vision demo");
    expect(html).toContain("Illustrative story · no customer systems touched");
    expect(html).toContain("Your software changed");
    expect(html).toContain("Your customers shouldn’t chase the fix");
    expect(html).toContain("This is a vision we are testing—not a customer result");
    expect(html).toContain("Available today");
    expect(html).toContain("What we’re proving next");
    expect(html).toContain("Try it on a public project");
    expect(html).toContain("Developer evidence");
    expect(html).not.toContain("customer-proven");
    expect(html).not.toContain("verified outcome");
  });
});

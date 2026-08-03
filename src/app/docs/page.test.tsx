import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import DocsPage from "@/app/docs/page";

describe("controlled-alpha documentation", () => {
  it("documents the working API and unpublished runtime boundaries", () => {
    const html = renderToStaticMarkup(<DocsPage />);

    expect(html).toContain("Experimental localization API");
    expect(html).toContain("review-ready proposal");
    expect(html).toContain("not published to npm");
    expect(html).toContain("estimated initial-context reduction");
    expect(html).not.toContain("npx locus-context");
    expect(html).not.toContain("approve loop");
  });
});

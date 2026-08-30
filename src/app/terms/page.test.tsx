import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import TermsPage from "@/app/terms/page";

describe("public early-access terms", () => {
  it("states the experimental service and external-write boundaries", () => {
    const html = renderToStaticMarkup(<TermsPage />);

    expect(html).toContain("Effective August 30, 2026");
    expect(html).toContain("public early access");
    expect(html).toContain("External repository writes and billing are disabled");
    expect(html).toContain("operated by Tarang Goyal");
    expect(html).not.toContain("public beta");
  });
});

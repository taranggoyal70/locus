import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import SupportPage from "@/app/support/page";

describe("public alpha support", () => {
  it("publishes status, incident, security, and data-request paths with response targets", () => {
    const html = renderToStaticMarkup(<SupportPage />);
    expect(html).toContain("Service status");
    expect(html).toContain("Incident severity");
    expect(html).toContain("response targets, not guarantees");
    expect(html).toContain("GitHub Security Advisory");
    expect(html).toContain("Data deletion");
  });
});

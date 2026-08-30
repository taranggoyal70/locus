import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import PrivacyPage from "@/app/privacy/page";

describe("public early-access privacy policy", () => {
  it("names durable data, providers, retention limits, and deletion routes", () => {
    const html = renderToStaticMarkup(<PrivacyPage />);

    expect(html).toContain("Effective August 30, 2026");
    expect(html).toContain("public repositories only");
    expect(html).toContain("Durable Run records");
    expect(html).toContain("Clerk, Supabase, GitHub, and Vercel");
    expect(html).toContain("30 days");
    expect(html).toContain("90 days");
    expect(html).toContain("request deletion");
  });
});

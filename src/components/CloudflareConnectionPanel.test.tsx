import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CloudflareConnectionPanel } from "@/components/CloudflareConnectionPanel";

describe("Cloudflare connection setup", () => {
  it("explains BYOK in plain language without exposing a token value", () => {
    const html = renderToStaticMarkup(<CloudflareConnectionPanel />);

    expect(html).toContain("one Agent Run per day across Locus");
    expect(html).toContain("Cloudflare Account ID");
    expect(html).toContain("Workers AI API token");
    expect(html).toContain("Encrypted before storage");
    expect(html).toContain('type="password"');
    expect(html).not.toContain("secret-cloudflare");
  });
});

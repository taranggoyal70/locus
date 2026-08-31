import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AlphaSettingsNotice } from "@/components/AlphaSettingsNotice";

describe("controlled-alpha Settings notice", () => {
  it("states the current product boundary without advertising disabled capabilities", () => {
    const html = renderToStaticMarkup(<AlphaSettingsNotice />);

    expect(html).toContain("Public early access");
    expect(html).toContain("Public Repos only");
    expect(html).toContain("one shared Agent Run per UTC");
    expect(html).toContain("connect your own Cloudflare account");
    expect(html).not.toContain("subscription");
    expect(html).not.toContain("private repositories");
    expect(html).not.toContain("teams");
  });
});

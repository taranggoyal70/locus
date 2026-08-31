import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AlphaSettingsNotice } from "@/components/AlphaSettingsNotice";

describe("controlled-alpha Settings notice", () => {
  it("states the current product boundary without advertising disabled capabilities", () => {
    const html = renderToStaticMarkup(<AlphaSettingsNotice />);

    expect(html).toContain("Public early access");
    expect(html).toContain("Public Repos only");
    expect(html).toContain("Agent Runs are not enabled for this account yet");
    expect(html).toContain("connect Cloudflare now");
    expect(html).not.toContain("subscription");
    expect(html).not.toContain("private repositories");
    expect(html).not.toContain("teams");
  });

  it("states the shared boundary only for an enabled account", () => {
    const html = renderToStaticMarkup(<AlphaSettingsNotice runStartEnabled />);

    expect(html).toContain("Your account can use one shared Agent Run per UTC day");
    expect(html).not.toContain("not enabled for this account");
  });
});

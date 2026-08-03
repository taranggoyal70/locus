import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AlphaSettingsNotice } from "@/components/AlphaSettingsNotice";

describe("controlled-alpha Settings notice", () => {
  it("states the current product boundary without advertising disabled capabilities", () => {
    const html = renderToStaticMarkup(<AlphaSettingsNotice />);

    expect(html).toContain("Controlled alpha");
    expect(html).toContain("public repositories");
    expect(html).toContain("invited design partners");
    expect(html).not.toContain("subscription");
    expect(html).not.toContain("private repositories");
    expect(html).not.toContain("teams");
  });
});

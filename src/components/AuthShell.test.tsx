import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AuthShell } from "@/components/AuthShell";

describe("controlled-alpha authentication shell", () => {
  it("shows factual alpha boundaries before authentication", () => {
    const html = renderToStaticMarkup(
      <AuthShell eyebrow="Alpha" title="Sign in" description="Continue to Locus.">
        Form
      </AuthShell>,
    );

    expect(html).toContain("Invite-only controlled alpha");
    expect(html).toContain("External writes");
    expect(html).toContain("Disabled");
    expect(html).not.toContain("public beta");
    expect(html).not.toContain("after delivery");
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LandingPage } from "@/components/LandingPage";

describe("controlled-alpha landing contract", () => {
  it("states the supported workflow and benchmark limits", () => {
    const html = renderToStaticMarkup(<LandingPage />);

    expect(html).toContain("Invite-only alpha");
    expect(html).toContain("Request alpha access");
    expect(html).toContain("review-ready, check-passing proposal");
    expect(html).toContain("Illustrative example");
    expect(html).toContain("does not measure agent completion");
    expect(html).not.toContain("Public beta");
    expect(html).not.toContain("Start a verified Run");
    expect(html).not.toContain("Fewer total tokens per verified task");
    expect(html).not.toContain("measuring the whole token loop");
  });
});

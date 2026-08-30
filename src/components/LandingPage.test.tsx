import { writeFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LandingPage } from "@/components/LandingPage";

describe("public early-access landing contract", () => {
  it("states the supported workflow and benchmark limits", () => {
    const html = renderToStaticMarkup(<LandingPage />);
    const evidencePath = process.env.NO_MISTAKES_RENDERED_LANDING_HTML;
    if (evidencePath) writeFileSync(evidencePath, `${html}\n`);

    expect(html).toContain("Public early access");
    expect(html).toContain("Try Repo localization");
    expect(html).toContain("Request Agent Run access");
    expect(html).toContain("review-ready, check-passing proposal");
    expect(html).toContain("Illustrative example");
    expect(html).toContain("recall on the cases in our suite");
    expect(html).toContain("15 fixes across 3 repositories we own; the suite gates on full recall");
    expect(html).toContain("does not measure agent completion");
    expect(html).not.toContain("Public beta");
    expect(html).not.toContain("Start a verified Run");
    expect(html).not.toContain("Fewer total tokens per verified task");
    expect(html).not.toContain("measuring the whole token loop");
  });
});

import { writeFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LandingPage } from "@/components/LandingPage";

describe("public early-access landing contract", () => {
  it("states the supported workflow and benchmark limits", () => {
    const html = renderToStaticMarkup(<LandingPage />);
    const evidencePath = process.env.NO_MISTAKES_RENDERED_LANDING_HTML;
    if (evidencePath) writeFileSync(evidencePath, `${html}\n`);

    expect(html).toContain("Paste a public GitHub project. Locus finds the files an AI coding tool needs and shows why.");
    expect(html).toContain("Localize a public Repo");
    expect(html).toContain("Free for JavaScript, TypeScript, and Python Repos. No card. No repository write access.");
    expect(html).toContain("Watch the migration demo");
    expect(html).toContain('href="/demo"');
    expect(html).toContain("Request Agent Run access");
    // The tag dropped a redundant "access required" — it already says invite-gated.
    expect(html).toContain("invite-gated");
    expect(html).toContain("review-ready, check-passing proposal");
    // The hero figure is a recorded localization, never an invented one.
    expect(html).toContain("Recorded run on");
    expect(html).toContain("shadcn-ui/taxonomy");
    expect(html).not.toContain("Illustrative example");
    expect(html).toContain("recall on the cases in our suite");
    expect(html).toContain("15 fixes across 3 repositories we own; the suite gates on full recall");
    expect(html).toContain("does not measure agent completion");
    expect(html).not.toContain("Public beta");
    expect(html).not.toContain("Start a verified Run");
    expect(html).not.toContain("Fewer total tokens per verified task");
    expect(html).not.toContain("measuring the whole token loop");
    expect(html).not.toContain("\u2014");
  });
});

import { writeFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LandingPage } from "@/components/LandingPage";

describe("public early-access landing contract", () => {
  it("states the supported workflow and benchmark limits", () => {
    vi.stubEnv("LOCUS_SELF_SERVE", "");
    const html = renderToStaticMarkup(<LandingPage />);
    const evidencePath = process.env.NO_MISTAKES_RENDERED_LANDING_HTML;
    if (evidencePath) writeFileSync(evidencePath, `${html}\n`);

    expect(html).toContain("Paste a public GitHub project. Locus finds the files an AI coding tool needs and shows why.");
    expect(html).toContain("Localize a public Repo");
    expect(html).toContain("Free for JavaScript, TypeScript, and Python Repos. No card. No repository write access.");
    expect(html).toContain("Watch the migration demo");
    expect(html).toContain("See a Slice here, no sign-in");
    expect(html).toContain("Every Slice here is a recorded run of the real");
    expect(html).toContain('href="/demo"');
    expect(html).toContain("Request Agent Run access");
    // The tag dropped a redundant "access required": it already says invite-gated.
    expect(html).toContain("invite-gated");
    expect(html).toContain("review-ready, check-passing proposal");
    // The hero figure is a recorded localization, never an invented one.
    expect(html).toContain("Recorded run on");
    expect(html).toContain("shadcn-ui/taxonomy");
    expect(html).not.toContain("Illustrative example");
    expect(html).toContain("fix-file recall on held-out Repos");
    expect(html).toContain("60 fixes across 6 third-party Repos, every one scored");
    expect(html).toContain("on the 57 cases Locus localized; 3 Widened to the whole Repo");
    expect(html).not.toContain("repositories we own");
    expect(html).toContain("does not measure agent completion");
    expect(html).not.toContain("Public beta");
    expect(html).not.toContain("Start a verified Run");
    expect(html).not.toContain("Fewer total tokens per verified task");
    expect(html).not.toContain("measuring the whole token loop");
    expect(html).not.toContain("\u2014");
  });

  it("offers Agent Runs directly when self serve is open", () => {
    vi.stubEnv("LOCUS_SELF_SERVE", "open");
    const html = renderToStaticMarkup(<LandingPage />);

    expect(html).toContain("Any verified account can continue");
    expect(html).toContain("Start an Agent Run");
    expect(html).not.toContain("Invited design partners");
    expect(html).not.toContain("Request Agent Run access");
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

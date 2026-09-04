import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { OnboardingSteps } from "@/components/OnboardingBanner";

describe("workspace onboarding", () => {
  it("teaches the evidence-first Run workflow", () => {
    const html = renderToStaticMarkup(<OnboardingSteps tier="free" />);

    expect(html).toContain("public Repo");
    expect(html).toContain("Review the proposal");
    expect(html).not.toContain("exact files");
    expect(html).not.toContain("Copy the context");
  });

  it("tells an admitted account to start a Run, not to wait for an invitation", () => {
    // Step three read "Start an invited Run" for everyone. The banner exists to
    // teach the workflow, so a step that misdescribes what the reader can
    // actually do is worse than showing no banner at all.
    for (const tier of ["free", "partner", "pro"] as const) {
      const html = renderToStaticMarkup(<OnboardingSteps tier={tier} />);
      expect(html, tier).toContain("Start an Agent Run");
      expect(html, tier).not.toContain("invited");
    }
  });

  it("points a visitor at access rather than at a step they cannot take", () => {
    const html = renderToStaticMarkup(<OnboardingSteps tier="visitor" />);
    expect(html).toContain("Request Agent Run access");
  });

  it("keeps the four steps in order", () => {
    const html = renderToStaticMarkup(<OnboardingSteps tier="free" />);
    const positions = ["1. Load", "2. Describe", "3. Start", "4. Review"].map((step) =>
      html.indexOf(step),
    );
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});

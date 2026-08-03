import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { OnboardingBanner } from "@/components/OnboardingBanner";

describe("controlled-alpha onboarding", () => {
  it("teaches the evidence-first Run workflow", () => {
    const html = renderToStaticMarkup(<OnboardingBanner />);

    expect(html).toContain("public Repo");
    expect(html).toContain("Review the proposal");
    expect(html).toContain("Start an invited Run");
    expect(html).not.toContain("exact files");
    expect(html).not.toContain("Copy the context");
  });
});

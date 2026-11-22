import { describe, expect, it } from "vitest";

import { loadLandingEngine } from "@/lib/landing-engine";
import { RECORDED_RESULT } from "@/lib/landing-slice";

describe("the landing page's in-browser engine", () => {
  it("reproduces the recorded run", async () => {
    const { run } = await loadLandingEngine();
    const result = run(RECORDED_RESULT.task);

    expect(result.slice.map(({ path }) => path)).toEqual(RECORDED_RESULT.slice.map(({ path }) => path));
    expect(result.sliceTokens).toBe(RECORDED_RESULT.sliceTokens);
  });

  it("answers a different task with a different Slice", async () => {
    const { run } = await loadLandingEngine();
    const result = run("update the marketing pricing page");

    expect(result.widened).toBe(false);
    expect(result.anchorPaths).toContain("app/(marketing)/pricing/page.tsx");
    expect(result.slice.length).toBeLessThan(RECORDED_RESULT.slice.length);
  });

  it("Widens to the whole Repo instead of guessing, and says what it could not find", async () => {
    const { repo, run } = await loadLandingEngine();
    const result = run("kubernetes helm chart rollback");

    expect(result.widened).toBe(true);
    expect(result.slice).toHaveLength(Object.keys(repo.files).length);
    expect(result.refinement?.unmatchedTerms).toContain("kubernetes");
  });
});

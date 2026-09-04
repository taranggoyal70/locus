import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import SupportPage from "@/app/support/page";
import { runQuotaForTier } from "@/lib/admission";

afterEach(() => {
  vi.unstubAllEnvs();
});

/**
 * Public surfaces that make a claim about who can start an Agent Run.
 *
 * check:alpha-claims reads these files for banned wording and cannot catch this
 * class: "Agent Runs are available to invited design partners" is accurate in
 * the source and false to the reader the moment self-serve opens. The only way
 * to catch it is to render the page under both settings and compare.
 */
describe("public copy follows the admission door", () => {
  it("keeps the invite-only claim while self-serve is closed", () => {
    vi.stubEnv("LOCUS_SELF_SERVE", "");
    expect(renderToStaticMarkup(<SupportPage />)).toContain("invited design partners");
  });

  it("drops the invite-only claim once self-serve is open", () => {
    vi.stubEnv("LOCUS_SELF_SERVE", "open");
    const html = renderToStaticMarkup(<SupportPage />);
    expect(html).not.toContain("invited design partners");
    expect(html).toContain("free account");
  });

  it("quotes the free tier's real daily allowance rather than restating a number", () => {
    vi.stubEnv("LOCUS_SELF_SERVE", "open");
    // Derived from the quota table, so changing the tier cannot leave this page
    // advertising the old figure.
    const daily = runQuotaForTier("free").maxDailyRuns;
    expect(renderToStaticMarkup(<SupportPage />)).toContain(`${daily} per day`);
  });
});

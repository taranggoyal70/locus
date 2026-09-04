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
    expect(html).toContain("shared daily slot");
  });

  it("does not advertise the per-account allowance as guaranteed capacity", () => {
    vi.stubEnv("LOCUS_SELF_SERVE", "open");
    // Free execution capacity is one shared Run per UTC day across the whole
    // deployment, so the Tier's per-account daily number is a ceiling rather
    // than an allocation and must not be printed as a promise here.
    const daily = runQuotaForTier("free").maxDailyRuns;
    expect(renderToStaticMarkup(<SupportPage />)).not.toContain(`${daily} per day`);
  });
});

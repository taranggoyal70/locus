import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AlphaSettingsNotice } from "@/components/AlphaSettingsNotice";
import { ADMISSION_TIERS, runQuotaForTier } from "@/lib/admission";

describe("Settings access notice", () => {
  it("states the current product boundary without advertising disabled capabilities", () => {
    const html = renderToStaticMarkup(<AlphaSettingsNotice tier="visitor" />);

    expect(html).toContain("Public early access");
    // The visitor heading no longer names an invitation. A visitor may be
    // waitlisted, unverified, at the ceiling, or suspended, and only the first
    // of those is waiting for an invitation at all.
    expect(html).toContain("not enabled for this account");
    expect(html).not.toContain("invited design partners");
    expect(html).not.toContain("subscription");
    expect(html).not.toContain("private repositories");
    expect(html).not.toContain("teams");
  });

  it("never tells an admitted account it needs an invitation", () => {
    // The previous single message said Agent Runs were "limited to invited
    // design partners" to everyone, including accounts that already had them.
    // check:alpha-claims cannot catch that: the sentence is accurate in the
    // source and wrong only for the person reading it.
    for (const tier of ["free", "pro"] as const) {
      expect(renderToStaticMarkup(<AlphaSettingsNotice tier={tier} />)).not.toMatch(
        /invited design partners|not enabled for this account/,
      );
    }
  });

  it("quotes the allowance the tier actually has", () => {
    for (const tier of ADMISSION_TIERS) {
      if (tier === "visitor") continue;
      const quota = runQuotaForTier(tier);
      const html = renderToStaticMarkup(<AlphaSettingsNotice tier={tier} />);
      expect(html, tier).toContain(`${quota.maxActiveRuns} Agent Run`);
      expect(html, tier).toContain(`${quota.maxDailyRuns} per day`);
    }
  });

  it("keeps external delivery described as off for every tier", () => {
    // Delivery is withheld by CAPABILITY_RELEASE regardless of tier. A notice
    // that let a paid tier imply otherwise would be selling something unbuilt.
    for (const tier of ["free", "partner", "pro"] as const) {
      expect(renderToStaticMarkup(<AlphaSettingsNotice tier={tier} />), tier).toMatch(
        /delivery is off for every plan/,
      );
    }
  });
});

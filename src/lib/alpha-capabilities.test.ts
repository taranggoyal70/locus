import { describe, expect, it } from "vitest";

import { alphaCapabilitiesForUser } from "@/lib/alpha-capabilities";

describe("controlled-alpha capabilities", () => {
  it("denies every capability without an allowlisted user", () => {
    expect(alphaCapabilitiesForUser(null, "user_founder")).toEqual({
      runStart: false,
      githubConnect: false,
      privateRepoRead: false,
      teams: false,
      savingsClaims: false,
      delivery: false,
      billing: false,
    });
    expect(alphaCapabilitiesForUser("user_founder", "")).toEqual({
      runStart: false,
      githubConnect: false,
      privateRepoRead: false,
      teams: false,
      savingsClaims: false,
      delivery: false,
      billing: false,
    });
  });

  it("lets an explicitly allowlisted user start Runs while external writes stay disabled", () => {
    expect(
      alphaCapabilitiesForUser(
        "user_design_partner",
        " user_founder, user_design_partner ,,",
      ),
    ).toEqual({
      runStart: true,
      githubConnect: false,
      privateRepoRead: false,
      teams: false,
      savingsClaims: false,
      delivery: false,
      billing: false,
    });
  });
});

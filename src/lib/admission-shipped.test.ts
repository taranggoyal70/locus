import { afterEach, describe, expect, it, vi } from "vitest";

import { admissionFromEnvironment } from "@/lib/admission";

afterEach(() => {
  vi.unstubAllEnvs();
});

// The tripwire on what production actually exposes.
//
// Every other Admission test describes the ladder as designed. This one pins the
// shape a real request gets today, so widening access cannot happen as a side
// effect of adding a tier, adjusting the capability table, or refactoring the
// resolver. Changing these expectations is the deliberate act of opening the
// product, and it should be visible on its own in a diff.
describe("shipped controlled-alpha capabilities", () => {
  const NOTHING = {
    runStart: false,
    githubConnect: false,
    privateRepoRead: false,
    teams: false,
    savingsClaims: false,
    delivery: false,
    billing: false,
  };

  it("denies every capability without an allowlisted user", () => {
    vi.stubEnv("ALPHA_ALLOWED_USER_IDS", "user_founder");
    expect(admissionFromEnvironment(null).capabilities).toEqual(NOTHING);

    vi.stubEnv("ALPHA_ALLOWED_USER_IDS", "");
    expect(admissionFromEnvironment("user_founder").capabilities).toEqual(NOTHING);
  });

  it("lets an explicitly allowlisted user start Runs while external writes stay disabled", () => {
    vi.stubEnv("ALPHA_ALLOWED_USER_IDS", " user_founder, user_design_partner ,,");
    expect(admissionFromEnvironment("user_design_partner").capabilities).toEqual({
      ...NOTHING,
      runStart: true,
    });
  });

  it("keeps self-serve closed even when the environment opens it", () => {
    // admissionFromEnvironment is the outage fallback and the signed-out answer.
    // Neither may admit a stranger, whatever LOCUS_SELF_SERVE says, because the
    // suspension list is exactly what it cannot read.
    vi.stubEnv("ALPHA_ALLOWED_USER_IDS", "");
    vi.stubEnv("LOCUS_SELF_SERVE", "open");
    expect(admissionFromEnvironment("user_stranger").capabilities).toEqual(NOTHING);
  });
});

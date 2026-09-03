import { describe, expect, it } from "vitest";

import { admissionWithCapabilities } from "@/lib/admission";
import { NO_RUN_ACCESS, runAccessCopy, runAccessFromAdmission } from "@/lib/run-access";

function access(overrides: Partial<typeof NO_RUN_ACCESS>) {
  return { ...NO_RUN_ACCESS, ...overrides };
}

describe("runAccessFromAdmission", () => {
  it("carries the decision the server made rather than re-deriving it", () => {
    const admission = admissionWithCapabilities({
      userId: "user_partner",
      partnerUserIds: "user_partner",
      subscriptionActive: false,
      selfServeOpen: false,
      emailVerified: true,
      selfServeCapacity: true,
    });
    expect(runAccessFromAdmission(admission)).toEqual({
      canStart: true,
      tier: "partner",
      reason: "partner_allowlist",
      quota: { maxActiveRuns: 2, maxDailyRuns: 10 },
    });
  });

  it("defaults a client with no server decision to no access at all", () => {
    expect(NO_RUN_ACCESS.canStart).toBe(false);
    expect(NO_RUN_ACCESS.quota).toEqual({ maxActiveRuns: 0, maxDailyRuns: 0 });
  });
});

describe("runAccessCopy", () => {
  it("states the plan's daily allowance when the account can run", () => {
    expect(
      runAccessCopy(access({ canStart: true, tier: "free", quota: { maxActiveRuns: 1, maxDailyRuns: 3 } })),
    ).toMatchObject({ action: "Run task with Locus" });
    expect(
      runAccessCopy(access({ canStart: true, quota: { maxActiveRuns: 1, maxDailyRuns: 3 } })).explanation,
    ).toContain("3 Agent Runs per day");
  });

  it("says Run, not Runs, for an allowance of one", () => {
    expect(
      runAccessCopy(access({ canStart: true, quota: { maxActiveRuns: 1, maxDailyRuns: 1 } })).explanation,
    ).toContain("1 Agent Run per day");
  });

  it("asks a signed-out visitor to sign in rather than to wait for an invitation", () => {
    expect(runAccessCopy(access({ reason: "signed_out" })).action).toBe("Sign in to run");
  });

  it("does not promise a waitlisted account an invitation it may not get", () => {
    const copy = runAccessCopy(access({ reason: "waitlist" }));
    expect(copy.action).toBe("Request access");
    expect(copy.explanation).not.toMatch(/invit/i);
  });

  it("never tells a suspended account to wait for access", () => {
    // The old single refusal said "available only to invited design partners",
    // which reads to a banned user as "you are next in line".
    const copy = runAccessCopy(access({ reason: "suspended" }));
    expect(copy.explanation).toMatch(/contact support/i);
    expect(copy.explanation).not.toMatch(/invit|waitlist|batch/i);
  });

  it("never claims an allowance it is refusing to honour", () => {
    for (const reason of ["signed_out", "waitlist", "suspended"] as const) {
      expect(runAccessCopy(access({ reason })).explanation).not.toMatch(/per day/);
    }
  });
});

describe("refusals lead somewhere", () => {
  it("sends every actionable refusal to a real destination", () => {
    expect(runAccessCopy(access({ reason: "signed_out" })).href).toBe("/sign-in");
    expect(runAccessCopy(access({ reason: "waitlist" })).href).toBe("/pricing#request-access");
    expect(runAccessCopy(access({ reason: "suspended" })).href).toBe("/support");
  });

  it("offers no destination when the account can already run", () => {
    expect(runAccessCopy(access({ canStart: true, quota: { maxActiveRuns: 1, maxDailyRuns: 3 } })).href)
      .toBeNull();
  });

  it("offers no destination for a refusal the user cannot act on", () => {
    // A capability withheld by the release record is a deployment state. Sending
    // the user somewhere would imply an action that would change nothing.
    expect(runAccessCopy(access({ reason: "partner_allowlist" })).href).toBeNull();
  });
});

describe("signup barrier refusals", () => {
  it("tells an unverified account what it can do about it", () => {
    // This is the one refusal in the set the user can clear themselves, so it
    // must not land in the generic "temporarily unavailable" branch, which
    // would send someone away from a problem they could fix in a minute.
    const copy = runAccessCopy(access({ reason: "unverified_email" }));
    expect(copy.action).toBe("Verify your email");
    expect(copy.href).toBe("/settings");
    expect(copy.explanation).not.toMatch(/temporarily unavailable/i);
  });

  it("says capacity, not suspicion, when the ceiling is reached", () => {
    // The account did nothing wrong. Reusing the waitlist or suspension wording
    // would imply a judgement about them rather than a limit on the service.
    const copy = runAccessCopy(access({ reason: "at_capacity" }));
    expect(copy.explanation).toMatch(/at capacity/i);
    expect(copy.explanation).not.toMatch(/contact support|cannot start/i);
  });

  it("still tells every refusal apart", () => {
    const reasons = [
      "signed_out",
      "waitlist",
      "unverified_email",
      "at_capacity",
      "suspended",
    ] as const;
    const explanations = reasons.map((reason) => runAccessCopy(access({ reason })).explanation);
    expect(new Set(explanations).size).toBe(reasons.length);
  });
});

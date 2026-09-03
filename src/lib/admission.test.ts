import { describe, expect, it } from "vitest";

import {
  ADMISSION_TIERS,
  applyCapabilityRelease,
  CAPABILITY_RELEASE,
  capabilitiesForTier,
  isAdmissionTier,
  resolveAdmission,
  runQuotaForTier,
  tierAtLeast,
} from "@/lib/admission";

describe("Admission tiers", () => {
  it("orders the tiers from least to most admitted", () => {
    expect(ADMISSION_TIERS).toEqual(["visitor", "free", "partner", "pro"]);
  });

  it("recognises only the named tiers", () => {
    expect(isAdmissionTier("free")).toBe(true);
    expect(isAdmissionTier("pro")).toBe(true);
    expect(isAdmissionTier("enterprise")).toBe(false);
    expect(isAdmissionTier("")).toBe(false);
    expect(isAdmissionTier(null)).toBe(false);
    expect(isAdmissionTier(2)).toBe(false);
  });

  it("compares tiers by position rather than by name", () => {
    expect(tierAtLeast("pro", "free")).toBe(true);
    expect(tierAtLeast("free", "free")).toBe(true);
    expect(tierAtLeast("free", "partner")).toBe(false);
    expect(tierAtLeast("visitor", "free")).toBe(false);
  });
});

describe("Capabilities for a Tier", () => {
  it("grants a visitor nothing", () => {
    expect(capabilitiesForTier("visitor")).toEqual({
      runStart: false,
      githubConnect: false,
      privateRepoRead: false,
      teams: false,
      savingsClaims: false,
      delivery: false,
      billing: false,
    });
  });

  it("lets a free account run a public Repo to a proposal and pay to go further", () => {
    expect(capabilitiesForTier("free")).toEqual({
      runStart: true,
      githubConnect: true,
      privateRepoRead: false,
      teams: false,
      savingsClaims: true,
      delivery: false,
      billing: true,
    });
  });

  it("gives an invited partner private Repos and delivery without a billing surface", () => {
    expect(capabilitiesForTier("partner")).toEqual({
      runStart: true,
      githubConnect: true,
      privateRepoRead: true,
      teams: false,
      savingsClaims: true,
      delivery: true,
      billing: false,
    });
  });

  it("grants a paid account every capability", () => {
    expect(capabilitiesForTier("pro")).toEqual({
      runStart: true,
      githubConnect: true,
      privateRepoRead: true,
      teams: true,
      savingsClaims: true,
      delivery: true,
      billing: true,
    });
  });

  it("never lets a lower tier hold a capability a higher tier lacks, except billing", () => {
    // Billing is the one deliberate non-monotonic capability: partners are
    // comped, so they sit above `free` on every axis but the payment surface.
    const axes = [
      "runStart",
      "githubConnect",
      "privateRepoRead",
      "teams",
      "savingsClaims",
      "delivery",
    ] as const;

    for (const axis of axes) {
      const held = ADMISSION_TIERS.map((tier) => capabilitiesForTier(tier)[axis]);
      const sorted = [...held].sort((a, b) => Number(a) - Number(b));
      expect(held, `${axis} must not be revoked by a higher tier`).toEqual(sorted);
    }
  });

  it("returns a fresh record so a caller cannot mutate the shared table", () => {
    const first = capabilitiesForTier("pro");
    first.delivery = false;
    expect(capabilitiesForTier("pro").delivery).toBe(true);
  });
});

describe("Run quota for a Tier", () => {
  it("gives a free account a small allowance it can finish in one sitting", () => {
    expect(runQuotaForTier("free")).toEqual({ maxActiveRuns: 1, maxDailyRuns: 3 });
  });

  it("keeps the invited-partner allowance the controlled alpha already ran on", () => {
    expect(runQuotaForTier("partner")).toEqual({ maxActiveRuns: 2, maxDailyRuns: 10 });
  });

  it("gives a paid account room to work in parallel", () => {
    expect(runQuotaForTier("pro")).toEqual({ maxActiveRuns: 5, maxDailyRuns: 50 });
  });

  it("admits a visitor to nothing", () => {
    expect(runQuotaForTier("visitor")).toEqual({ maxActiveRuns: 0, maxDailyRuns: 0 });
  });

  it("never shrinks an allowance as the tier rises", () => {
    const active = ADMISSION_TIERS.map((tier) => runQuotaForTier(tier).maxActiveRuns);
    const daily = ADMISSION_TIERS.map((tier) => runQuotaForTier(tier).maxDailyRuns);
    expect(active).toEqual([...active].sort((a, b) => a - b));
    expect(daily).toEqual([...daily].sort((a, b) => a - b));
  });

  it("stays inside the range claim_agent_run_slot will accept for a running tier", () => {
    // Migration 016 rejects p_max_active outside 1..100 and p_max_daily outside
    // 1..10000. A tier that can start a Run must therefore carry limits the
    // authoritative claim can actually be called with.
    for (const tier of ADMISSION_TIERS) {
      if (!capabilitiesForTier(tier).runStart) continue;
      const quota = runQuotaForTier(tier);
      expect(quota.maxActiveRuns, `${tier} active`).toBeGreaterThanOrEqual(1);
      expect(quota.maxActiveRuns, `${tier} active`).toBeLessThanOrEqual(100);
      expect(quota.maxDailyRuns, `${tier} daily`).toBeGreaterThanOrEqual(1);
      expect(quota.maxDailyRuns, `${tier} daily`).toBeLessThanOrEqual(10_000);
    }
  });
});

describe("resolveAdmission", () => {
  const closed = { partnerUserIds: "", subscriptionActive: false, selfServeOpen: false };

  it("admits a signed-out visitor to nothing", () => {
    expect(resolveAdmission({ userId: null, ...closed, selfServeOpen: true })).toEqual({
      tier: "visitor",
      reason: "signed_out",
    });
  });

  it("holds a signed-in account at visitor while self-serve is closed", () => {
    expect(resolveAdmission({ userId: "user_stranger", ...closed })).toEqual({
      tier: "visitor",
      reason: "waitlist",
    });
  });

  it("admits any signed-in account to free once self-serve opens", () => {
    expect(
      resolveAdmission({ userId: "user_stranger", ...closed, selfServeOpen: true }),
    ).toEqual({ tier: "free", reason: "self_serve" });
  });

  it("admits an invited partner even while self-serve is closed", () => {
    expect(
      resolveAdmission({
        ...closed,
        userId: "user_design_partner",
        partnerUserIds: " user_founder, user_design_partner ,,",
      }),
    ).toEqual({ tier: "partner", reason: "partner_allowlist" });
  });

  it("admits a paying account to pro without waiting for self-serve", () => {
    expect(
      resolveAdmission({ ...closed, userId: "user_customer", subscriptionActive: true }),
    ).toEqual({ tier: "pro", reason: "subscription" });
  });

  it("takes the highest tier when more than one rule matches", () => {
    expect(
      resolveAdmission({
        userId: "user_design_partner",
        partnerUserIds: "user_design_partner",
        subscriptionActive: true,
        selfServeOpen: true,
      }),
    ).toEqual({ tier: "pro", reason: "subscription" });
  });

  it("ignores the allowlist entirely for a signed-out request", () => {
    // A blank userId must never match a blank allowlist entry. Splitting a
    // trailing comma yields "", and treating that as a member would admit every
    // anonymous request as a partner.
    expect(
      resolveAdmission({ userId: null, ...closed, partnerUserIds: "user_founder,," }),
    ).toEqual({ tier: "visitor", reason: "signed_out" });
    expect(
      resolveAdmission({ userId: "", ...closed, partnerUserIds: "user_founder,," }),
    ).toEqual({ tier: "visitor", reason: "signed_out" });
  });
});

describe("capability release", () => {
  it("can only withhold a capability, never grant one the Tier lacks", () => {
    const everythingReleased = {
      runStart: true,
      githubConnect: true,
      privateRepoRead: true,
      teams: true,
      savingsClaims: true,
      delivery: true,
      billing: true,
    };
    expect(applyCapabilityRelease(capabilitiesForTier("free"), everythingReleased)).toEqual(
      capabilitiesForTier("free"),
    );
  });

  it("withholds an unreleased capability from every tier", () => {
    const noDelivery = {
      runStart: true,
      githubConnect: true,
      privateRepoRead: true,
      teams: true,
      savingsClaims: true,
      delivery: false,
      billing: true,
    };
    expect(applyCapabilityRelease(capabilitiesForTier("pro"), noDelivery)).toEqual({
      ...capabilitiesForTier("pro"),
      delivery: false,
    });
  });

  it("reproduces the controlled alpha exactly for an invited partner", () => {
    // The shipped release state must keep production where it is: an invited
    // partner starts Runs and nothing else reaches the outside world. This test
    // is the tripwire on CAPABILITY_RELEASE, so widening it is a deliberate,
    // reviewable edit rather than a side effect of adding a tier.
    expect(applyCapabilityRelease(capabilitiesForTier("partner"), CAPABILITY_RELEASE)).toEqual({
      runStart: true,
      githubConnect: false,
      privateRepoRead: false,
      teams: false,
      savingsClaims: false,
      delivery: false,
      billing: false,
    });
  });

  it("keeps a visitor at nothing whatever is released", () => {
    expect(applyCapabilityRelease(capabilitiesForTier("visitor"), CAPABILITY_RELEASE)).toEqual(
      capabilitiesForTier("visitor"),
    );
  });
});

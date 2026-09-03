import { describe, expect, it } from "vitest";

import {
  ADMISSION_TIERS,
  capabilitiesForTier,
  isAdmissionTier,
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

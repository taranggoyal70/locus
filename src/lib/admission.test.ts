import { describe, expect, it } from "vitest";

import { ADMISSION_TIERS, isAdmissionTier, tierAtLeast } from "@/lib/admission";

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

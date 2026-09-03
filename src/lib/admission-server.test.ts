import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const readStoredAdmission = vi.fn();
const hasActiveSubscription = vi.fn();

vi.mock("@/lib/admission-store", () => ({
  readStoredAdmission: (userId: string) => readStoredAdmission(userId),
  hasActiveSubscription: (userId: string) => hasActiveSubscription(userId),
}));

vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const { admissionForAccount } = await import("@/lib/admission-server");

beforeEach(() => {
  readStoredAdmission.mockResolvedValue(null);
  hasActiveSubscription.mockResolvedValue(false);
  vi.stubEnv("ALPHA_ALLOWED_USER_IDS", "");
  vi.stubEnv("LOCUS_SELF_SERVE", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("admissionForAccount", () => {
  it("answers a signed-out request without touching the database", async () => {
    const admission = await admissionForAccount(null);
    expect(admission.tier).toBe("visitor");
    expect(admission.reason).toBe("signed_out");
    expect(readStoredAdmission).not.toHaveBeenCalled();
    expect(hasActiveSubscription).not.toHaveBeenCalled();
  });

  it("carries the Tier's capabilities and Run quota, not just its name", async () => {
    vi.stubEnv("ALPHA_ALLOWED_USER_IDS", "user_partner");
    const admission = await admissionForAccount("user_partner");
    expect(admission.tier).toBe("partner");
    expect(admission.runQuota).toEqual({ maxActiveRuns: 2, maxDailyRuns: 10 });
    // Still intersected with the release gate, so a partner starts Runs and
    // reaches nothing external.
    expect(admission.capabilities.runStart).toBe(true);
    expect(admission.capabilities.delivery).toBe(false);
  });

  it("holds a stranger on the waitlist while self-serve is closed", async () => {
    const admission = await admissionForAccount("user_stranger");
    expect(admission).toMatchObject({ tier: "visitor", reason: "waitlist" });
  });

  it("admits a stranger to free once self-serve is open", async () => {
    vi.stubEnv("LOCUS_SELF_SERVE", "open");
    const admission = await admissionForAccount("user_stranger");
    expect(admission).toMatchObject({ tier: "free", reason: "self_serve" });
    expect(admission.runQuota).toEqual({ maxActiveRuns: 1, maxDailyRuns: 3 });
  });

  it("reads the two inputs concurrently", async () => {
    let resolveStored: (value: null) => void = () => {};
    readStoredAdmission.mockReturnValue(new Promise((resolve) => { resolveStored = resolve; }));
    const pending = admissionForAccount("user_stranger");
    // The subscription read must already have been issued while the stored read
    // is still outstanding. This sits in front of every authenticated render, so
    // serialising the two would put a second round trip on the critical path.
    expect(hasActiveSubscription).toHaveBeenCalledWith("user_stranger");
    resolveStored(null);
    await pending;
  });

  describe("when the database is unreachable", () => {
    beforeEach(() => {
      readStoredAdmission.mockRejectedValue(new Error("connection reset"));
    });

    it("keeps an invited partner working through the incident", async () => {
      vi.stubEnv("ALPHA_ALLOWED_USER_IDS", "user_partner");
      const admission = await admissionForAccount("user_partner");
      expect(admission).toMatchObject({ tier: "partner", reason: "partner_allowlist" });
    });

    it("refuses a stranger even though self-serve is open", async () => {
      // The suspension list is in the row that just failed to load. Admitting
      // strangers while unable to read who is refused would let a suspended
      // account back in for exactly as long as nobody is watching.
      vi.stubEnv("LOCUS_SELF_SERVE", "open");
      const admission = await admissionForAccount("user_stranger");
      expect(admission).toMatchObject({ tier: "visitor", reason: "waitlist" });
    });

    it("does not grant a paid tier it could not verify", async () => {
      hasActiveSubscription.mockResolvedValue(true);
      const admission = await admissionForAccount("user_customer");
      expect(admission.tier).toBe("visitor");
    });
  });
});

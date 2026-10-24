import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@clerk/nextjs/server", () => ({ auth: authMock }));

vi.mock("@/lib/admission-server", async () => {
  // Admission resolution is exercised in admission.test.ts. Here it must not
  // reach the database, or this test would assert a capability decision that
  // depended on the order of unrelated Supabase stubs.
  const { admissionFromEnvironment } = await import("@/lib/admission");
  const { CAPABILITY_RELEASE } = await import("@/lib/admission");
  return {
    admissionForAccount: async (userId: string | null) => admissionFromEnvironment(userId),
    accountCan: async (userId: string | null, capability: keyof typeof CAPABILITY_RELEASE) =>
      CAPABILITY_RELEASE[capability]
      && admissionFromEnvironment(userId).capabilities[capability],
  };
});

import { GET } from "@/app/api/github/connect/route";

describe("controlled-alpha GitHub connection", () => {
  beforeEach(() => {
    authMock.mockResolvedValue({ userId: "user_design_partner" });
    vi.stubEnv("ALPHA_ALLOWED_USER_IDS", "user_design_partner");
  });

  it("keeps repository-wide OAuth disabled for alpha users", async () => {
    const response = await GET();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "GitHub connections are not available during early access.",
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@clerk/nextjs/server", () => ({ auth: authMock }));

vi.mock("@/lib/admission-server", async () => {
  // Admission resolution is exercised in admission.test.ts. Here it must not
  // reach the database, or this test would assert a capability decision that
  // depended on the order of unrelated Supabase stubs.
  const { admissionFromEnvironment } = await import("@/lib/admission");
  return { admissionForAccount: async (userId: string | null) => admissionFromEnvironment(userId) };
});

import { GET } from "@/app/api/github/callback/route";

describe("controlled-alpha GitHub callback", () => {
  beforeEach(() => {
    authMock.mockResolvedValue({ userId: "user_design_partner" });
    vi.stubEnv("ALPHA_ALLOWED_USER_IDS", "user_design_partner");
  });

  it("rejects OAuth callbacks before exchanging credentials", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const response = await GET(
      new Request("https://locus.example/api/github/callback?code=secret&state=signed"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://locus.example/settings?error=github_alpha_disabled",
    );
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });
});

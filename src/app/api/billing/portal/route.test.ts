import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@clerk/nextjs/server", () => ({ auth: authMock }));

import { POST } from "@/app/api/billing/portal/route";

describe("controlled-alpha billing portal", () => {
  beforeEach(() => {
    authMock.mockResolvedValue({ userId: "user_design_partner" });
    vi.stubEnv("ALPHA_ALLOWED_USER_IDS", "user_design_partner");
  });

  it("cannot create a billing portal session", async () => {
    const response = await POST();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Billing is disabled during the controlled alpha.",
    });
  });
});

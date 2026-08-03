import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@clerk/nextjs/server", () => ({ auth: authMock }));

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
      error: "GitHub connections are not available during the controlled alpha.",
    });
  });
});

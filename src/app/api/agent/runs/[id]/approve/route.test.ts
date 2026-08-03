import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@clerk/nextjs/server", () => ({ auth: authMock }));

import { POST } from "@/app/api/agent/runs/[id]/approve/route";

describe("controlled-alpha Run delivery", () => {
  beforeEach(() => {
    authMock.mockResolvedValue({ userId: "user_design_partner" });
    vi.stubEnv("ALPHA_ALLOWED_USER_IDS", "user_design_partner");
  });

  it("cannot approve an external GitHub write", async () => {
    const response = await POST(
      new Request("http://localhost/api/agent/runs/run-id/approve", { method: "POST" }),
      { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001" }) },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "GitHub delivery is disabled during the controlled alpha.",
    });
  });
});

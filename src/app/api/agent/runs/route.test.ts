import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@clerk/nextjs/server", () => ({ auth: authMock }));

import { POST } from "@/app/api/agent/runs/route";

function runRequest() {
  return new Request("http://localhost/api/agent/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      repository: "vercel/next.js",
      baseRef: "main",
      task: "Fix the documented alpha capability guard",
      acceptanceCriteria: ["The guarded route rejects users outside the alpha"],
    }),
  });
}

describe("controlled-alpha Agent Run starts", () => {
  beforeEach(() => {
    authMock.mockResolvedValue({ userId: "user_outside_alpha" });
    vi.stubEnv("ALPHA_ALLOWED_USER_IDS", "user_design_partner");
  });

  it("rejects authenticated users outside the design-partner allowlist", async () => {
    const response = await POST(runRequest());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Agent Runs are limited to invited design partners during the controlled alpha.",
    });
  });
});

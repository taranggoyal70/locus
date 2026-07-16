import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@clerk/nextjs/server", () => ({ auth: authMock }));

import { POST } from "@/app/api/attachments/route";

function upload(file: File, headers: Record<string, string> = {}) {
  const form = new FormData();
  form.set("file", file);
  return new Request("http://localhost/api/attachments", { method: "POST", body: form, headers });
}

describe("attachment extraction API", () => {
  beforeEach(() => authMock.mockResolvedValue({ userId: "user_123" }));

  it("requires authentication", async () => {
    authMock.mockResolvedValueOnce({ userId: null });
    const response = await POST(upload(new File(["ticket"], "ticket.txt", { type: "text/plain" })));
    expect(response.status).toBe(401);
  });

  it("extracts text without storing the uploaded file", async () => {
    const response = await POST(upload(new File(["Fix checkout button"], "ticket.txt", { type: "text/plain" })));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      attachment: { name: "ticket.txt", kind: "text", text: "Fix checkout button" },
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("rejects cross-site uploads", async () => {
    const response = await POST(upload(
      new File(["ticket"], "ticket.txt", { type: "text/plain" }),
      { "sec-fetch-site": "cross-site" },
    ));
    expect(response.status).toBe(403);
  });
});

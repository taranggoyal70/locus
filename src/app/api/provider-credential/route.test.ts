import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const statusMock = vi.hoisted(() => vi.fn());
const saveMock = vi.hoisted(() => vi.fn());
const deleteMock = vi.hoisted(() => vi.fn());

vi.mock("@clerk/nextjs/server", () => ({ auth: authMock }));
vi.mock("@/lib/agent/provider-credential-store", () => ({
  cloudflareCredentialStatus: statusMock,
  saveCloudflareCredential: saveMock,
  deleteCloudflareCredential: deleteMock,
}));

import { DELETE, GET, PUT } from "@/app/api/provider-credential/route";

function mutation(body?: unknown) {
  return new Request("http://localhost/api/provider-credential", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("Cloudflare provider credential route", () => {
  beforeEach(() => {
    authMock.mockReset();
    statusMock.mockReset();
    saveMock.mockReset();
    deleteMock.mockReset();
    authMock.mockResolvedValue({ userId: "user-owner" });
  });

  it("returns connection status without returning credential material", async () => {
    statusMock.mockResolvedValue({ configured: true });

    const response = await GET();

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({ configured: true });
    expect(JSON.stringify(payload)).not.toContain("token");
    expect(JSON.stringify(payload)).not.toContain("account");
  });

  it("saves a valid credential without echoing the API token", async () => {
    saveMock.mockResolvedValue(undefined);
    const apiToken = "cloudflare-token-that-is-long-enough";

    const response = await PUT(mutation({
      accountId: "0123456789abcdef0123456789abcdef",
      apiToken,
    }));

    expect(response.status).toBe(200);
    expect(saveMock).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-owner",
      credential: {
        accountId: "0123456789abcdef0123456789abcdef",
        apiToken,
      },
    }));
    expect(await response.json()).toEqual({ configured: true });
  });

  it("rejects cross-site writes and lets the owner remove a connection", async () => {
    const crossSite = mutation({
      accountId: "0123456789abcdef0123456789abcdef",
      apiToken: "cloudflare-token-that-is-long-enough",
    });
    crossSite.headers.set("origin", "https://attacker.example");
    expect((await PUT(crossSite)).status).toBe(403);
    expect(saveMock).not.toHaveBeenCalled();

    deleteMock.mockResolvedValue(undefined);
    const remove = new Request("http://localhost/api/provider-credential", {
      method: "DELETE",
      headers: { origin: "http://localhost" },
    });
    const response = await DELETE(remove);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ configured: false });
    expect(deleteMock).toHaveBeenCalledWith("user-owner");
  });
});

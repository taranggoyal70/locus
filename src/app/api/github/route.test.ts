import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const serviceClientMock = vi.hoisted(() => vi.fn());
const consumeRateLimitMock = vi.hoisted(() => vi.fn());

vi.mock("@clerk/nextjs/server", () => ({ auth: authMock }));
vi.mock("@/lib/supabase", () => ({ serviceClient: serviceClientMock }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: consumeRateLimitMock }));

import { POST } from "@/app/api/github/route";

function request(body: string, ip: string, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/github", {
    method: "POST",
    body,
    headers: { "content-type": "application/json", "x-forwarded-for": ip, origin: "http://localhost", ...headers },
  });
}

describe("GitHub repository API request guards", () => {
  beforeEach(() => {
    authMock.mockResolvedValue({ userId: "user_123" });
    serviceClientMock.mockReset();
    consumeRateLimitMock.mockResolvedValue({ allowed: true, remaining: 5, retryAfterSeconds: 0 });
  });

  it("rejects signed-out requests", async () => {
    authMock.mockResolvedValueOnce({ userId: null });
    const response = await POST(request('{"url":"owner/repo"}', "198.51.100.10"));
    expect(response.status).toBe(401);
  });

  it("returns a generic client error for malformed JSON", async () => {
    const response = await POST(request("{", "198.51.100.1"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Request body must be valid JSON." });
  });

  it("rejects oversized request bodies before parsing", async () => {
    const declared = await POST(request("{}", "198.51.100.2", { "content-length": "2048" }));
    const streamed = await POST(request(JSON.stringify({ padding: "x".repeat(2_048) }), "198.51.100.4"));
    expect(declared.status).toBe(413);
    expect(streamed.status).toBe(413);
  });

  it("rejects browser requests initiated by another site", async () => {
    const response = await POST(request('{"url":"owner/repo"}', "198.51.100.5", { "sec-fetch-site": "cross-site" }));
    expect(response.status).toBe(403);
  });

  it("enforces the durable repository-read limit", async () => {
    consumeRateLimitMock.mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterSeconds: 42 });

    const response = await POST(request('{"url":"owner/repo"}', "198.51.100.3"));

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("42");
    expect(consumeRateLimitMock).toHaveBeenCalledWith({
      namespace: "github-repository-read",
      identity: "198.51.100.3",
      limit: 6,
      windowSeconds: 60,
    });
  });

  it("fails safely when GitHub returns a malformed tree", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ default_branch: "main" }))
      .mockResolvedValueOnce(Response.json({ sha: "abc123", tree: null }));

    const response = await POST(request('{"url":"owner/repo"}', "198.51.100.20"));

    expect(response.status).toBe(502);
    expect(serviceClientMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ error: "GitHub returned an invalid repository tree." });
    fetchMock.mockRestore();
  });

  it("describes private repository reads as unavailable", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 404 }));

    const response = await POST(request('{"url":"owner/private-repo"}', "198.51.100.22"));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Repo not found. Controlled alpha currently supports public repositories only.",
    });
    expect(serviceClientMock).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });

  it("drops a source file when its downloaded body exceeds the safety limit", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ default_branch: "main" }))
      .mockResolvedValueOnce(Response.json({
        sha: "abc123",
        tree: [{ path: "src/page.tsx", type: "blob", size: 10 }],
      }))
      .mockResolvedValueOnce(new Response("x".repeat(100_001)));

    const response = await POST(request('{"url":"owner/repo"}', "198.51.100.21"));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "GitHub returned a file tree, but its source files could not be downloaded.",
    });
    fetchMock.mockRestore();
  });
});

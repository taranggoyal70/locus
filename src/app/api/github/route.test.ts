import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());

vi.mock("@clerk/nextjs/server", () => ({ auth: authMock }));

import { POST } from "@/app/api/github/route";

function request(body: string, ip: string, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/github", {
    method: "POST",
    body,
    headers: { "content-type": "application/json", "x-forwarded-for": ip, ...headers },
  });
}

describe("GitHub repository API request guards", () => {
  beforeEach(() => {
    authMock.mockResolvedValue({ userId: "user_123" });
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

  it("rate-limits repeated expensive requests by client IP", async () => {
    const responses = [];
    for (let index = 0; index < 7; index += 1) {
      responses.push(await POST(request('{"url":"invalid"}', "198.51.100.3")));
    }
    expect(responses.slice(0, 6).every((response) => response.status === 400)).toBe(true);
    expect(responses[6].status).toBe(429);
    expect(responses[6].headers.get("retry-after")).toBeTruthy();
  });

  it("fails safely when GitHub returns a malformed tree", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ default_branch: "main" }))
      .mockResolvedValueOnce(Response.json({ sha: "abc123", tree: null }));

    const response = await POST(request('{"url":"owner/repo"}', "198.51.100.20"));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: "GitHub returned an invalid repository tree." });
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

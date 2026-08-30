import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const serviceClientMock = vi.hoisted(() => vi.fn());
const consumeRateLimitMock = vi.hoisted(() => vi.fn());
const trackMock = vi.hoisted(() => vi.fn());

vi.mock("@clerk/nextjs/server", () => ({ auth: authMock }));
vi.mock("@/lib/supabase", () => ({ serviceClient: serviceClientMock }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: consumeRateLimitMock }));
vi.mock("@/lib/analytics", () => ({ track: trackMock }));

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
    await expect(response.json()).resolves.toEqual({
      error: "Cross-site requests are not allowed.",
      code: "invalid",
    });
  });

  it("enforces the durable repository-read limit", async () => {
    consumeRateLimitMock.mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterSeconds: 42 });

    const response = await POST(request('{"url":"owner/repo"}', "198.51.100.3"));

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("42");
    await expect(response.json()).resolves.toEqual({
      error: "Too many repository requests. Try again shortly.",
      code: "rate-limited",
    });
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
      .mockResolvedValueOnce(Response.json({ sha: "abcdef1234567890", commit: { tree: { sha: "treesha" } } }))
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
      error: "Repo not found. Public early access supports public repositories only.",
      code: "unavailable",
    });
    expect(serviceClientMock).not.toHaveBeenCalled();
    fetchMock.mockRestore();
  });

  it("rejects private metadata even when the server token can see it", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ default_branch: "main", private: true, visibility: "private" }));

    const response = await POST(request('{"url":"owner/private-repo"}', "198.51.100.23"));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Public early access supports public repositories only.",
      code: "unavailable",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    fetchMock.mockRestore();
  });

  it("distinguishes a missing revision from an unavailable Repo", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ default_branch: "main", private: false, visibility: "public" }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));

    const response = await POST(request('{"url":"owner/repo@missing"}', "198.51.100.24"));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Commit or branch “missing” was not found.",
      code: "invalid",
    });
    fetchMock.mockRestore();
  });

  it("drops a source file when its downloaded body exceeds the safety limit", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ default_branch: "main" }))
      .mockResolvedValueOnce(Response.json({ sha: "abcdef1234567890", commit: { tree: { sha: "treesha" } } }))
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

/**
 * The stub returns five commits, matching the route's recent-change fan-out, so
 * these miss and hit assertions are the source of truth for this route's GitHub
 * API call budget.
 */
describe("GitHub repository API call budget", () => {
  const COLD_LOAD_GITHUB_API_CALLS = 9;
  const CACHE_HIT_GITHUB_API_CALLS = 2;
  let apiCalls: string[];

  function stubGitHub() {
    apiCalls = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const parsed = new URL(url);
      if (parsed.hostname === "api.github.com") apiCalls.push(url);
      // GitHub resolves owner and repository names case-insensitively; a
      // case-sensitive stub would fail a request the real API would serve.
      const path = parsed.pathname.toLowerCase();

      if (parsed.hostname === "api.github.com" && path === "/repos/owner/repo") {
        return Response.json({ default_branch: "main", private: false, visibility: "public", description: "d" });
      }
      if (parsed.hostname === "api.github.com" && path === "/repos/owner/repo/commits/main") {
        return Response.json({ sha: "abcdef1234567890", commit: { tree: { sha: "treesha" } } });
      }
      if (parsed.hostname === "api.github.com" && path === "/repos/owner/repo/git/trees/treesha") {
        return Response.json({ sha: "treesha", tree: [{ path: "src/a.ts", type: "blob", size: 30 }] });
      }
      if (parsed.hostname === "api.github.com" && path === "/repos/owner/repo/commits") {
        return Response.json([{ sha: "c1" }, { sha: "c2" }, { sha: "c3" }, { sha: "c4" }, { sha: "c5" }]);
      }
      if (
        parsed.hostname === "api.github.com"
        && ["c1", "c2", "c3", "c4", "c5"].some((sha) => path === `/repos/owner/repo/commits/${sha}`)
      ) return Response.json({ files: [{ filename: "src/a.ts" }] });
      if (
        parsed.hostname === "raw.githubusercontent.com"
        && path === "/owner/repo/abcdef1234567890/src/a.ts"
      ) return new Response("export const a = 1;\n");
      return new Response("nope", { status: 404 });
    }));
  }

  beforeEach(async () => {
    authMock.mockResolvedValue({ userId: "user_123" });
    consumeRateLimitMock.mockResolvedValue({ allowed: true, remaining: 5, retryAfterSeconds: 0 });
    const { clearRepoCacheForTests } = await import("@/app/api/github/route");
    clearRepoCacheForTests();
    stubGitHub();
  });

  it("serves a repeat load from cache after resolving the branch head", async () => {
    const first = await POST(request('{"url":"owner/repo"}', "198.51.100.20"));
    expect(first.status).toBe(200);
    const firstCallCount = apiCalls.length;
    expect(firstCallCount).toBe(COLD_LOAD_GITHUB_API_CALLS);

    apiCalls.length = 0;
    const second = await POST(request('{"url":"owner/repo"}', "198.51.100.20"));

    expect(second.status).toBe(200);
    expect(apiCalls).toHaveLength(CACHE_HIT_GITHUB_API_CALLS);
    expect(apiCalls).toEqual([
      "https://api.github.com/repos/owner/repo",
      "https://api.github.com/repos/owner/repo/commits/main",
    ]);
    expect(await second.json()).toEqual(await first.clone().json());
  });

  it("still refuses a repository that turned private after being cached", async () => {
    expect((await POST(request('{"url":"owner/repo"}', "198.51.100.21"))).status).toBe(200);

    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "https://api.github.com/repos/owner/repo") {
        return Response.json({ default_branch: "main", private: true });
      }
      return new Response("nope", { status: 404 });
    }));

    // The cache must never be the reason a private repository is served.
    const response = await POST(request('{"url":"owner/repo"}', "198.51.100.21"));
    expect(response.status).toBe(403);
  });

  it("does not serve one repository's files for another", async () => {
    await POST(request('{"url":"owner/repo"}', "198.51.100.22"));
    apiCalls.length = 0;

    const other = await POST(request('{"url":"owner/different"}', "198.51.100.22"));

    expect(other.status).toBe(404);
    expect(apiCalls.length).toBeGreaterThan(0);
  });

  it("folds owner and repository case so one repo is cached once", async () => {
    await POST(request('{"url":"owner/repo"}', "198.51.100.23"));
    apiCalls.length = 0;

    const upper = await POST(request('{"url":"Owner/Repo"}', "198.51.100.23"));

    expect(upper.status).toBe(200);
    expect(apiCalls).toEqual([
      "https://api.github.com/repos/Owner/Repo",
      "https://api.github.com/repos/Owner/Repo/commits/main",
    ]);
  });

  it("revalidates a mutable branch before serving cached source", async () => {
    let commitSha = "commit-old";
    let treeSha = "tree-old";
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const parsed = new URL(url);
      if (url === "https://api.github.com/repos/owner/repo") {
        return Response.json({ default_branch: "main", private: false, visibility: "public", description: "d" });
      }
      if (url === "https://api.github.com/repos/owner/repo/commits/main") {
        return Response.json({ sha: commitSha, commit: { tree: { sha: treeSha } } });
      }
      if (url === `https://api.github.com/repos/owner/repo/git/trees/${treeSha}?recursive=1`) {
        return Response.json({ sha: treeSha, tree: [{ path: "src/a.ts", type: "blob", size: 30 }] });
      }
      if (url === `https://raw.githubusercontent.com/owner/repo/${commitSha}/src/a.ts`) {
        return new Response(`export const version = "${commitSha}";\n`);
      }
      if (parsed.hostname === "api.github.com" && parsed.pathname === "/repos/owner/repo/commits") {
        return Response.json([]);
      }
      return new Response("nope", { status: 404 });
    }));

    const first = await POST(request('{"url":"owner/repo"}', "198.51.100.24"));
    expect(first.status).toBe(200);
    expect((await first.json()).repo.files["src/a.ts"]).toBe('export const version = "commit-old";\n');

    commitSha = "commit-new";
    treeSha = "tree-new";
    const second = await POST(request('{"url":"owner/repo"}', "198.51.100.24"));

    expect(second.status).toBe(200);
    expect((await second.json()).repo.files["src/a.ts"]).toBe('export const version = "commit-new";\n');
  });

  it("rebuilds request-specific metadata around cached source", async () => {
    const unnamed = await POST(request('{"url":"owner/repo"}', "198.51.100.25"));
    expect(unnamed.status).toBe(200);
    expect((await unnamed.clone().json()).repo).toMatchObject({
      name: "owner/repo",
      slug: "owner-repo",
    });

    const named = await POST(request('{"url":"owner/repo@main"}', "198.51.100.25"));

    expect(named.status).toBe(200);
    expect((await named.json()).repo).toMatchObject({
      name: "owner/repo@abcdef1",
      slug: "owner-repo-abcdef1",
    });
  });

  // `Repos loaded (30d)` counts this event. Emitting it only when the cache
  // misses would silently redefine the metric as "cache misses" and undercount
  // precisely the repeat loads the cache exists to serve.
  it("counts a repository load whether or not the cache served it", async () => {
    trackMock.mockClear();

    await POST(request('{"url":"owner/repo"}', "198.51.100.24"));
    const [fresh] = trackMock.mock.calls.at(-1) ?? [];
    expect(fresh).toMatchObject({
      event: "repo_loaded",
      properties: expect.objectContaining({ cached: false }),
    });
    expect(fresh.properties).not.toHaveProperty("repo");

    trackMock.mockClear();
    const second = await POST(request('{"url":"owner/repo"}', "198.51.100.24"));
    expect(second.status).toBe(200);

    const [hit] = trackMock.mock.calls.at(-1) ?? [];
    expect(trackMock).toHaveBeenCalledTimes(1);
    expect(hit).toMatchObject({
      event: "repo_loaded",
      properties: expect.objectContaining({ cached: true }),
    });
    expect(hit.properties).not.toHaveProperty("repo");
  });

  it("reports the same file count on a hit as on the load that filled it", async () => {
    trackMock.mockClear();
    await POST(request('{"url":"owner/repo"}', "198.51.100.25"));
    const [fresh] = trackMock.mock.calls.at(-1) ?? [];

    trackMock.mockClear();
    await POST(request('{"url":"owner/repo"}', "198.51.100.25"));
    const [hit] = trackMock.mock.calls.at(-1) ?? [];

    // A hit that reported a different count would corrupt the metric rather than
    // merely undercount it.
    expect(hit.properties.files).toBe(fresh.properties.files);
    expect(hit.properties.truncated).toBe(fresh.properties.truncated);
  });
});

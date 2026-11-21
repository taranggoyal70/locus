import { expect, it } from "vitest";

import { verifyPublicLaunch } from "./verify-public-launch.mjs";

const pages = new Set(["/", "/demo", "/pricing", "/docs", "/privacy", "/terms", "/support"]);

function response(body, init = {}) {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
    ...init,
  });
}

it("verifies the public pages, health contract, and signed-out Run boundary", async () => {
  const requests = [];
  const fetcher = async (url, init = {}) => {
    const parsed = new URL(url);
    requests.push([parsed.pathname, init.method ?? "GET"]);
    if (pages.has(parsed.pathname)) {
      return response(`<html><head><title>Locus</title></head><body>${"ready ".repeat(80)}</body></html>`);
    }
    if (parsed.pathname === "/api/health") {
      return response(JSON.stringify({
        status: "ok",
        revision: "abc1234",
        readiness: { missing: [], alerting: "external_health_check", admission: "self_serve" },
      }), { headers: { "content-type": "application/json" } });
    }
    if (parsed.pathname === "/api/agent/runs") {
      return response(JSON.stringify({ error: "Authentication required." }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }
    throw new Error(`Unexpected path ${parsed.pathname}`);
  };

  const result = await verifyPublicLaunch({
    baseUrl: "https://example.com",
    expectedRevision: "abc1234",
    fetcher,
  });

  expect(result.revision).toBe("abc1234");
  expect(result.pagesChecked).toBe(7);
  expect(requests.at(-1)).toEqual(["/api/agent/runs", "POST"]);
});

it("fails when production is healthy but not self-serve", async () => {
  const fetcher = async (url) => {
    const path = new URL(url).pathname;
    if (pages.has(path)) return response(`<title>Locus</title>${"ready ".repeat(80)}`);
    if (path === "/api/health") {
      return response(JSON.stringify({
        status: "ok",
        revision: "abc1234",
        readiness: { missing: [], alerting: "external_health_check", admission: "invite_only" },
      }), { headers: { "content-type": "application/json" } });
    }
    return response("{}", { status: 401, headers: { "content-type": "application/json" } });
  };

  await expect(
    verifyPublicLaunch({ baseUrl: "https://example.com", fetcher }),
  ).rejects.toThrow(/self-serve admission/i);
});

it("accepts a signed-out Run start that is redirected to sign-in", async () => {
  const fetcher = async (url) => {
    const path = new URL(url).pathname;
    if (pages.has(path)) return response(`<title>Locus</title>${"ready ".repeat(80)}`);
    if (path === "/api/health") {
      return response(JSON.stringify({
        status: "ok",
        revision: "abc1234",
        readiness: { missing: [], alerting: "external_health_check", admission: "self_serve" },
      }), { headers: { "content-type": "application/json" } });
    }
    const redirected = response(`<title>Sign in</title>${"account ".repeat(80)}`);
    Object.defineProperty(redirected, "url", { value: "https://example.com/sign-in" });
    return redirected;
  };

  await expect(
    verifyPublicLaunch({ baseUrl: "https://example.com", fetcher }),
  ).resolves.toBeDefined();
});

it("accepts Clerk's protected-route rewrite for signed-out Run starts", async () => {
  const fetcher = async (url) => {
    const path = new URL(url).pathname;
    if (pages.has(path)) return response(`<title>Locus</title>${"ready ".repeat(80)}`);
    if (path === "/api/health") {
      return response(JSON.stringify({
        status: "ok",
        revision: "abc1234",
        readiness: { missing: [], alerting: "external_health_check", admission: "self_serve" },
      }), { headers: { "content-type": "application/json" } });
    }
    return response(`<title>Locus</title>${"protected ".repeat(80)}`, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "x-clerk-auth-status": "signed-out",
        "x-clerk-auth-reason": "protect-rewrite, session-token-and-uat-missing",
      },
    });
  };

  await expect(
    verifyPublicLaunch({ baseUrl: "https://example.com", fetcher }),
  ).resolves.toBeDefined();
});

it("fails when a public page is unavailable", async () => {
  const fetcher = async (url) => {
    const path = new URL(url).pathname;
    if (path === "/demo") return response("missing", { status: 404 });
    if (pages.has(path)) return response(`<title>Locus</title>${"ready ".repeat(80)}`);
    throw new Error("Health should not be reached after the page failure");
  };

  await expect(
    verifyPublicLaunch({ baseUrl: "https://example.com", fetcher }),
  ).rejects.toThrow(/\/demo returned 404/);
});

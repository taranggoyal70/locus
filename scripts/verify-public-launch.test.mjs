import assert from "node:assert/strict";
import test from "node:test";

import { verifyPublicLaunch } from "./verify-public-launch.mjs";

const pages = new Set(["/", "/demo", "/pricing", "/docs", "/privacy", "/terms", "/support"]);

function response(body, init = {}) {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
    ...init,
  });
}

test("verifies the public pages, health contract, and signed-out Run boundary", async () => {
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

  assert.equal(result.revision, "abc1234");
  assert.equal(result.pagesChecked, 7);
  assert.deepEqual(requests.at(-1), ["/api/agent/runs", "POST"]);
});

test("fails when production is healthy but not self-serve", async () => {
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

  await assert.rejects(
    verifyPublicLaunch({ baseUrl: "https://example.com", fetcher }),
    /self-serve admission/i,
  );
});

test("accepts a signed-out Run start that is redirected to sign-in", async () => {
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

  await assert.doesNotReject(verifyPublicLaunch({ baseUrl: "https://example.com", fetcher }));
});

test("accepts Clerk's protected-route rewrite for signed-out Run starts", async () => {
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

  await assert.doesNotReject(verifyPublicLaunch({ baseUrl: "https://example.com", fetcher }));
});

test("fails when a public page is unavailable", async () => {
  const fetcher = async (url) => {
    const path = new URL(url).pathname;
    if (path === "/demo") return response("missing", { status: 404 });
    if (pages.has(path)) return response(`<title>Locus</title>${"ready ".repeat(80)}`);
    throw new Error("Health should not be reached after the page failure");
  };

  await assert.rejects(
    verifyPublicLaunch({ baseUrl: "https://example.com", fetcher }),
    /\/demo returned 404/,
  );
});

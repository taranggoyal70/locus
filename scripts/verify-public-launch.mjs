import { pathToFileURL } from "node:url";

export const PUBLIC_PATHS = ["/", "/demo", "/pricing", "/docs", "/privacy", "/terms", "/support"];

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

async function checkedFetch(fetcher, url, init = {}) {
  const response = await fetcher(url, {
    signal: AbortSignal.timeout(20_000),
    ...init,
  });
  return response;
}

export async function verifyPublicLaunch({
  baseUrl,
  expectedRevision = "",
  fetcher = fetch,
}) {
  const origin = new URL(baseUrl).origin;

  for (const path of PUBLIC_PATHS) {
    const response = await checkedFetch(fetcher, `${origin}${path}`);
    requireCondition(response.status === 200, `${path} returned ${response.status}, expected 200`);
    requireCondition(
      response.headers.get("content-type")?.includes("text/html"),
      `${path} did not return HTML`,
    );
    const body = await response.text();
    requireCondition(body.length >= 300, `${path} returned an unexpectedly small document`);
    requireCondition(/<title[ >]/i.test(body), `${path} did not include document metadata`);
  }

  const healthResponse = await checkedFetch(fetcher, `${origin}/api/health`);
  requireCondition(healthResponse.status === 200, `/api/health returned ${healthResponse.status}`);
  const health = await healthResponse.json();
  requireCondition(health.status === "ok", "Production health status is not ok");
  requireCondition(Array.isArray(health.readiness?.missing), "Health readiness is malformed");
  requireCondition(health.readiness.missing.length === 0, "Production reports missing readiness configuration");
  requireCondition(
    ["webhook", "external_health_check"].includes(health.readiness?.alerting),
    "Production alerting is not configured",
  );
  requireCondition(
    health.readiness?.admission === "self_serve",
    "Production does not report self-serve admission",
  );
  if (expectedRevision) {
    requireCondition(
      health.revision === expectedRevision.slice(0, 7),
      `Production revision ${health.revision ?? "unknown"} does not match ${expectedRevision.slice(0, 7)}`,
    );
  }

  const runResponse = await checkedFetch(fetcher, `${origin}/api/agent/runs`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: "{}",
  });
  const redirectedToAuth = runResponse.status === 200
    && runResponse.headers.get("content-type")?.includes("text/html")
    && ["/sign-in", "/sign-up"].some((path) => {
      try {
        return new URL(runResponse.url).pathname.startsWith(path);
      } catch {
        return false;
      }
    });
  const clerkProtected = runResponse.headers.get("x-clerk-auth-status") === "signed-out"
    && runResponse.headers.get("x-clerk-auth-reason")?.includes("protect-rewrite");
  requireCondition(
    runResponse.status === 401 || redirectedToAuth || clerkProtected,
    `Signed-out Agent Run start returned ${runResponse.status} without an authentication challenge`,
  );

  return {
    revision: health.revision,
    pagesChecked: PUBLIC_PATHS.length,
    admission: health.readiness.admission,
    alerting: health.readiness.alerting,
  };
}

async function main() {
  const baseUrl = process.env.PRODUCTION_BASE_URL ?? "https://locus-five-iota.vercel.app";
  const result = await verifyPublicLaunch({
    baseUrl,
    expectedRevision: process.env.EXPECTED_REVISION ?? "",
  });
  console.log(JSON.stringify({ status: "ok", ...result }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

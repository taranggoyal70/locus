import { NextResponse } from "next/server";

import packageJson from "../../../../package.json";
import { productionReadiness } from "@/lib/production-readiness";

export function GET() {
  const readiness = productionReadiness();
  return NextResponse.json(
    {
      status: readiness.ready ? "ok" : "degraded",
      version: packageJson.version,
      revision: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      readiness: {
        missing: readiness.missing,
        alerting: readiness.alerting,
      },
    },
    {
      status: readiness.ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

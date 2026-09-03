import { NextResponse } from "next/server";

import packageJson from "../../../../package.json";
import { productionReadiness } from "@/lib/production-readiness";

export async function GET() {
  const readiness = await productionReadiness();
  return NextResponse.json(
    {
      status: readiness.ready ? "ok" : "degraded",
      version: packageJson.version,
      revision: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      readiness: {
        missing: readiness.missing,
        alerting: readiness.alerting,
        // Which door is open. The rollout runbook has the operator confirm this
        // reads "self_serve" after setting LOCUS_SELF_SERVE, because only the
        // exact word `open` counts and a rejected value produces an invite-only
        // deployment with no error anywhere to say so.
        admission: readiness.admission,
      },
    },
    {
      status: readiness.ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

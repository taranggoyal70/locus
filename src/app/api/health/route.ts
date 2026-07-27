import { NextResponse } from "next/server";

import packageJson from "../../../../package.json";

export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      version: packageJson.version,
      revision: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

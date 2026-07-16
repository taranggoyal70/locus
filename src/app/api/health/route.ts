import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    { status: "ok", version: process.env.npm_package_version ?? "unknown" },
    { headers: { "Cache-Control": "no-store" } },
  );
}

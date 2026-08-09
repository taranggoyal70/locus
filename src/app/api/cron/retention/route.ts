import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { globalClient } from "@/lib/supabase-tenant";

function authorized(header: string | null, secret: string): boolean {
  if (!header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function GET(request: Request) {
  const secret = process.env["CRON_SECRET"]?.trim();
  if (!secret) {
    logger.error("retention.cron.not_configured");
    return NextResponse.json({ error: "Retention job is not configured." }, { status: 503 });
  }
  if (!authorized(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const db = globalClient("retention sweep spans every tenant by design");
  const { data, error } = await db.rpc("delete_expired_agent_data", {
    p_retention_days: 30,
  });
  if (error || !data?.[0]) {
    logger.error("retention.cron.failed", { name: error?.message ?? "missing result" });
    return NextResponse.json({ error: "Retention cleanup failed." }, { status: 500 });
  }
  logger.info("retention.cron.completed", data[0]);
  return NextResponse.json({ ok: true, deleted: data[0] });
}

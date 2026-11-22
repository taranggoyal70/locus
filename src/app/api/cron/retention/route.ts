import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { globalDb, rpc } from "@/lib/db";

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

  let deleted;
  try {
    [deleted] = await rpc(globalDb("retention sweep spans every tenant by design"), "delete_expired_agent_data", {
      p_retention_days: 30,
    });
  } catch (error) {
    logger.error("retention.cron.failed", { name: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ error: "Retention cleanup failed." }, { status: 500 });
  }
  if (!deleted) {
    logger.error("retention.cron.failed", { name: "missing result" });
    return NextResponse.json({ error: "Retention cleanup failed." }, { status: 500 });
  }
  logger.info("retention.cron.completed", deleted);
  return NextResponse.json({ ok: true, deleted });
}

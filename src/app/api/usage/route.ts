import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { tenantDb } from "@/lib/db";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = tenantDb(userId);
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Usage is a summary panel, so a part that cannot be read shows as empty
  // rather than failing the whole page.
  const countOf = (table: "projects" | "api_keys") => db
    .selectFrom(table)
    .select((eb) => eb.fn.countAll<number>().as("count"))
    .where("user_id", "=", userId)
    .executeTakeFirst()
    .then((row) => Number(row?.count ?? 0), () => 0);

  const [events, projectCount, keyCount] = await Promise.all([
    db
      .selectFrom("events")
      .select(["event", "created_at"])
      .where("user_id", "=", userId)
      .where("created_at", ">=", thirtyDaysAgo)
      .orderBy("created_at", "desc")
      .limit(500)
      .execute()
      .catch(() => []),
    countOf("projects"),
    countOf("api_keys"),
  ]);

  const byType: Record<string, number> = {};
  const byDay: Record<string, number> = {};
  for (const e of events) {
    byType[e.event] = (byType[e.event] ?? 0) + 1;
    const day = e.created_at.slice(0, 10);
    byDay[day] = (byDay[day] ?? 0) + 1;
  }

  return NextResponse.json({
    period: "30d",
    totalEvents: events.length,
    byType,
    byDay,
    projectCount,
    keyCount,
  });
}

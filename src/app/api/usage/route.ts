import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { serviceClient } from "@/lib/supabase";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = serviceClient();
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [eventsResult, projectsResult, keysResult] = await Promise.all([
    db
      .from("events")
      .select("event, created_at")
      .eq("user_id", userId)
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: false })
      .limit(500),
    db
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    db
      .from("api_keys")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);

  const events = eventsResult.data ?? [];
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
    projectCount: projectsResult.count ?? 0,
    keyCount: keysResult.count ?? 0,
  });
}

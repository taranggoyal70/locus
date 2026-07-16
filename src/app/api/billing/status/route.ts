import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { serviceClient } from "@/lib/supabase";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = serviceClient();
  const { data } = await db
    .from("subscriptions")
    .select("plan, status, created_at")
    .eq("user_id", userId)
    .single();

  if (!data || data.status !== "active") {
    return NextResponse.json({ plan: "free", status: "active" });
  }

  return NextResponse.json({
    plan: data.plan,
    status: data.status,
    subscribedAt: data.created_at,
  });
}

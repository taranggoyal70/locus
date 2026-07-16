import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { serviceClient } from "@/lib/supabase";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = serviceClient();
  const { data } = await db
    .from("github_connections")
    .select("github_username, scopes, created_at")
    .eq("user_id", userId)
    .single();

  if (!data) return NextResponse.json({ connected: false });

  return NextResponse.json({
    connected: true,
    username: data.github_username,
    scopes: data.scopes,
    connectedAt: data.created_at,
  });
}

export async function DELETE() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = serviceClient();
  await db.from("github_connections").delete().eq("user_id", userId);
  return NextResponse.json({ disconnected: true });
}

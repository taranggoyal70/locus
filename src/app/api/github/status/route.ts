import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { alphaCapabilitiesForUser } from "@/lib/alpha-capabilities";
import { sameOriginMutation } from "@/lib/request-security";
import { tenantClient } from "@/lib/supabase-tenant";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!alphaCapabilitiesForUser(userId).privateRepoRead) {
    return NextResponse.json(
      { error: "Private repository reads are unavailable during controlled alpha." },
      { status: 403 },
    );
  }

  const db = tenantClient(userId);
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

export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sameOriginMutation(request)) {
    return NextResponse.json({ error: "Cross-site requests are not allowed." }, { status: 403 });
  }

  const db = tenantClient(userId);
  await db.from("github_connections").delete().eq("user_id", userId);
  return NextResponse.json({ disconnected: true });
}

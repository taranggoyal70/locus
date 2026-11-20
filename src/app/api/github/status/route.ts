import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { accountCan } from "@/lib/admission-server";
import { sameOriginMutation } from "@/lib/request-security";
import { tenantDb } from "@/lib/db";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!await accountCan(userId, "privateRepoRead")) {
    return NextResponse.json(
      { error: "Private repository reads are unavailable during early access." },
      { status: 403 },
    );
  }

  // As before, an unreadable connection reads as not connected: the page then
  // offers to connect, which is harmless, rather than failing to render.
  const data = await tenantDb(userId)
    .selectFrom("github_connections")
    .select(["github_username", "scopes", "created_at"])
    .where("user_id", "=", userId)
    .executeTakeFirst()
    .catch(() => undefined);

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

  try {
    await tenantDb(userId).deleteFrom("github_connections").where("user_id", "=", userId).execute();
  } catch {
    // Reporting success here would leave a token the user believes is gone.
    return NextResponse.json({ error: "Failed to disconnect GitHub." }, { status: 500 });
  }
  return NextResponse.json({ disconnected: true });
}

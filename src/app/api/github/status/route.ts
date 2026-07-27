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
  const { data: connection, error: lookupError } = await db
    .from("github_connections")
    .select("access_token")
    .eq("user_id", userId)
    .maybeSingle();
  if (lookupError) {
    return NextResponse.json({ error: "Failed to load GitHub connection." }, { status: 500 });
  }

  if (connection?.access_token) {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: "GitHub token revocation is not configured. Revoke the Locus OAuth app in GitHub settings before retrying." },
        { status: 503 },
      );
    }
    const revokeResponse = await fetch(
      `https://api.github.com/applications/${encodeURIComponent(clientId)}/token`,
      {
        method: "DELETE",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ access_token: connection.access_token }),
      },
    );
    if (!revokeResponse.ok && revokeResponse.status !== 404) {
      return NextResponse.json({ error: "GitHub rejected token revocation. Try again." }, { status: 502 });
    }
  }

  const { error } = await db.from("github_connections").delete().eq("user_id", userId);
  if (error) {
    return NextResponse.json({ error: "Failed to remove GitHub connection." }, { status: 500 });
  }
  return NextResponse.json({ disconnected: true });
}

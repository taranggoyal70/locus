import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { serviceClient } from "@/lib/supabase";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const teamId = url.searchParams.get("teamId");
  if (!teamId) return NextResponse.json({ error: "teamId required." }, { status: 400 });

  const db = serviceClient();

  const { data: membership } = await db
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .single();
  if (!membership) return NextResponse.json({ error: "Not a member." }, { status: 403 });

  const { data: members } = await db
    .from("team_members")
    .select("id, user_id, role, created_at")
    .eq("team_id", teamId)
    .order("created_at");

  return NextResponse.json({ members: members ?? [] });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const { teamId, inviteUserId } = (body ?? {}) as Record<string, unknown>;
  if (typeof teamId !== "string" || typeof inviteUserId !== "string") {
    return NextResponse.json({ error: "teamId and inviteUserId required." }, { status: 400 });
  }

  const db = serviceClient();

  const { data: caller } = await db
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .single();
  if (!caller || !["owner", "admin"].includes(caller.role)) {
    return NextResponse.json({ error: "Only owners and admins can invite members." }, { status: 403 });
  }

  const { data: existing } = await db
    .from("team_members")
    .select("id")
    .eq("team_id", teamId)
    .eq("user_id", inviteUserId)
    .single();
  if (existing) return NextResponse.json({ error: "Already a member." }, { status: 409 });

  const { data: memberCount } = await db
    .from("team_members")
    .select("id", { count: "exact", head: true })
    .eq("team_id", teamId);
  if ((memberCount as unknown as number) >= 10) {
    return NextResponse.json({ error: "Team is at capacity (10 members on free plan)." }, { status: 403 });
  }

  const { error } = await db.from("team_members").insert({
    team_id: teamId,
    user_id: inviteUserId,
    role: "member",
  });
  if (error) return NextResponse.json({ error: "Failed to add member." }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const teamId = url.searchParams.get("teamId");
  const memberId = url.searchParams.get("memberId");
  if (!teamId || !memberId) {
    return NextResponse.json({ error: "teamId and memberId required." }, { status: 400 });
  }

  const db = serviceClient();

  const { data: caller } = await db
    .from("team_members")
    .select("role")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .single();
  if (!caller || !["owner", "admin"].includes(caller.role)) {
    return NextResponse.json({ error: "Only owners and admins can remove members." }, { status: 403 });
  }

  const { data: target } = await db
    .from("team_members")
    .select("user_id, role")
    .eq("id", memberId)
    .eq("team_id", teamId)
    .single();
  if (!target) return NextResponse.json({ error: "Member not found." }, { status: 404 });
  if (target.role === "owner") {
    return NextResponse.json({ error: "Cannot remove the team owner." }, { status: 403 });
  }

  await db.from("team_members").delete().eq("id", memberId);
  return NextResponse.json({ removed: true });
}

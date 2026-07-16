import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { serviceClient } from "@/lib/supabase";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = serviceClient();
  const { data: memberships } = await db
    .from("team_members")
    .select("team_id, role")
    .eq("user_id", userId);

  if (!memberships?.length) return NextResponse.json({ teams: [] });

  const teamIds = memberships.map((m) => m.team_id);
  const { data: teams } = await db
    .from("teams")
    .select("id, name, slug, owner_id, created_at")
    .in("id", teamIds)
    .order("created_at", { ascending: false });

  const enriched = (teams ?? []).map((t) => ({
    ...t,
    role: memberships.find((m) => m.team_id === t.id)?.role ?? "member",
  }));

  return NextResponse.json({ teams: enriched });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const name = typeof body === "object" && body !== null && "name" in body
    ? (body as { name?: unknown }).name : undefined;
  if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 60) {
    return NextResponse.json({ error: "Team name must be 2-60 characters." }, { status: 400 });
  }

  const db = serviceClient();

  const { data: existing } = await db
    .from("team_members")
    .select("team_id")
    .eq("user_id", userId);
  if ((existing?.length ?? 0) >= 5) {
    return NextResponse.json({ error: "You can be in at most 5 teams on the free plan." }, { status: 403 });
  }

  const slug = slugify(name.trim()) || "team";
  const { data: team, error } = await db
    .from("teams")
    .insert({ name: name.trim(), slug, owner_id: userId })
    .select("id, name, slug")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "A team with that name already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create team." }, { status: 500 });
  }

  await db.from("team_members").insert({ team_id: team.id, user_id: userId, role: "owner" });

  return NextResponse.json({ team }, { status: 201 });
}

export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const teamId = url.searchParams.get("id");
  if (!teamId) return NextResponse.json({ error: "Team ID required." }, { status: 400 });

  const db = serviceClient();
  const { data: team } = await db
    .from("teams")
    .select("owner_id")
    .eq("id", teamId)
    .single();

  if (!team) return NextResponse.json({ error: "Team not found." }, { status: 404 });
  if (team.owner_id !== userId) {
    return NextResponse.json({ error: "Only the team owner can delete it." }, { status: 403 });
  }

  await db.from("teams").delete().eq("id", teamId);
  return NextResponse.json({ deleted: true });
}

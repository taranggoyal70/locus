import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { accountCan } from "@/lib/admission-server";
import { databaseErrorCode, globalDb } from "@/lib/db";

function disabledResponse() {
  return NextResponse.json(
    { error: "Teams are unavailable during early access." },
    { status: 403 },
  );
}

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
  if (!(await accountCan(userId, "teams"))) return disabledResponse();

  const db = globalDb("team records are owned via team_members, not a user column");
  // As before, an unreadable membership list shows as no teams.
  const memberships = await db
    .selectFrom("team_members")
    .select(["team_id", "role"])
    .where("user_id", "=", userId)
    .execute()
    .catch(() => []);

  if (!memberships.length) return NextResponse.json({ teams: [] });

  const teamIds = memberships.map((m) => m.team_id);
  const teams = await db
    .selectFrom("teams")
    .select(["id", "name", "slug", "owner_id", "created_at"])
    .where("id", "in", teamIds)
    .orderBy("created_at", "desc")
    .execute()
    .catch(() => []);

  const enriched = teams.map((t) => ({
    ...t,
    role: memberships.find((m) => m.team_id === t.id)?.role ?? "member",
  }));

  return NextResponse.json({ teams: enriched });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await accountCan(userId, "teams"))) return disabledResponse();

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const name = typeof body === "object" && body !== null && "name" in body
    ? (body as { name?: unknown }).name : undefined;
  if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 60) {
    return NextResponse.json({ error: "Team name must be 2-60 characters." }, { status: 400 });
  }

  const db = globalDb("team records are owned via team_members, not a user column");

  try {
    const existing = await db
      .selectFrom("team_members")
      .select("team_id")
      .where("user_id", "=", userId)
      .execute();
    if (existing.length >= 5) {
      return NextResponse.json({ error: "You can be in at most 5 teams on the free plan." }, { status: 403 });
    }

    const slug = slugify(name.trim()) || "team";
    // One transaction, so a team never exists without its owner's membership.
    const team = await db.transaction().execute(async (trx) => {
      const created = await trx
        .insertInto("teams")
        .values({ name: name.trim(), slug, owner_id: userId })
        .returning(["id", "name", "slug"])
        .executeTakeFirstOrThrow();
      await trx.insertInto("team_members").values({ team_id: created.id, user_id: userId, role: "owner" }).execute();
      return created;
    });
    return NextResponse.json({ team }, { status: 201 });
  } catch (error) {
    if (databaseErrorCode(error) === "23505") {
      return NextResponse.json({ error: "A team with that name already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create team." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await accountCan(userId, "teams"))) return disabledResponse();

  const url = new URL(request.url);
  const teamId = url.searchParams.get("id");
  if (!teamId) return NextResponse.json({ error: "Team ID required." }, { status: 400 });

  const db = globalDb("team records are owned via team_members, not a user column");
  const team = await db
    .selectFrom("teams")
    .select("owner_id")
    .where("id", "=", teamId)
    .executeTakeFirst()
    .catch(() => undefined);

  if (!team) return NextResponse.json({ error: "Team not found." }, { status: 404 });
  if (team.owner_id !== userId) {
    return NextResponse.json({ error: "Only the team owner can delete it." }, { status: 403 });
  }

  try {
    await db.deleteFrom("teams").where("id", "=", teamId).where("owner_id", "=", userId).execute();
  } catch {
    return NextResponse.json({ error: "Failed to delete team." }, { status: 500 });
  }
  return NextResponse.json({ deleted: true });
}

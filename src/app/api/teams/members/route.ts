import { auth } from "@clerk/nextjs/server";
import type { Kysely } from "kysely";
import { NextResponse } from "next/server";

import { accountCan } from "@/lib/admission-server";
import { globalDb, type Database } from "@/lib/db";

/** The user's role in the team, or undefined when they are not in it (or it cannot be read). */
function roleIn(db: Kysely<Database>, teamId: string, userId: string) {
  return db
    .selectFrom("team_members")
    .select("role")
    .where("team_id", "=", teamId)
    .where("user_id", "=", userId)
    .executeTakeFirst()
    .catch(() => undefined);
}

function disabledResponse() {
  return NextResponse.json(
    { error: "Teams are unavailable during early access." },
    { status: 403 },
  );
}

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await accountCan(userId, "teams"))) return disabledResponse();

  const url = new URL(request.url);
  const teamId = url.searchParams.get("teamId");
  if (!teamId) return NextResponse.json({ error: "teamId required." }, { status: 400 });

  const db = globalDb("team administration acts on other members' rows; authorization is by team role");

  const membership = await roleIn(db, teamId, userId);
  if (!membership) return NextResponse.json({ error: "Not a member." }, { status: 403 });

  const members = await db
    .selectFrom("team_members")
    .select(["id", "user_id", "role", "created_at"])
    .where("team_id", "=", teamId)
    .orderBy("created_at")
    .execute()
    .catch(() => []);

  return NextResponse.json({ members });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await accountCan(userId, "teams"))) return disabledResponse();

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const { teamId, inviteUserId } = (body ?? {}) as Record<string, unknown>;
  if (typeof teamId !== "string" || typeof inviteUserId !== "string") {
    return NextResponse.json({ error: "teamId and inviteUserId required." }, { status: 400 });
  }

  const db = globalDb("team administration acts on other members' rows; authorization is by team role");

  const caller = await roleIn(db, teamId, userId);
  if (!caller || !["owner", "admin"].includes(caller.role)) {
    return NextResponse.json({ error: "Only owners and admins can invite members." }, { status: 403 });
  }

  if (await roleIn(db, teamId, inviteUserId)) {
    return NextResponse.json({ error: "Already a member." }, { status: 409 });
  }

  try {
    // This read used to compare the empty body of a count-only response with
    // 10, so the cap was never enforced. It is now the count itself.
    const { count } = await db
      .selectFrom("team_members")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where("team_id", "=", teamId)
      .executeTakeFirstOrThrow();
    if (Number(count) >= 10) {
      return NextResponse.json({ error: "Team is at capacity (10 members on free plan)." }, { status: 403 });
    }

    await db.insertInto("team_members").values({
      team_id: teamId,
      user_id: inviteUserId,
      role: "member",
    }).execute();
  } catch {
    return NextResponse.json({ error: "Failed to add member." }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await accountCan(userId, "teams"))) return disabledResponse();

  const url = new URL(request.url);
  const teamId = url.searchParams.get("teamId");
  const memberId = url.searchParams.get("memberId");
  if (!teamId || !memberId) {
    return NextResponse.json({ error: "teamId and memberId required." }, { status: 400 });
  }

  const db = globalDb("team administration acts on other members' rows; authorization is by team role");

  const caller = await roleIn(db, teamId, userId);
  if (!caller || !["owner", "admin"].includes(caller.role)) {
    return NextResponse.json({ error: "Only owners and admins can remove members." }, { status: 403 });
  }

  const target = await db
    .selectFrom("team_members")
    .select(["user_id", "role"])
    .where("id", "=", memberId)
    .where("team_id", "=", teamId)
    .executeTakeFirst()
    .catch(() => undefined);
  if (!target) return NextResponse.json({ error: "Member not found." }, { status: 404 });
  if (target.role === "owner") {
    return NextResponse.json({ error: "Cannot remove the team owner." }, { status: 403 });
  }

  try {
    await db.deleteFrom("team_members").where("id", "=", memberId).where("team_id", "=", teamId).execute();
  } catch {
    return NextResponse.json({ error: "Failed to remove member." }, { status: 500 });
  }
  return NextResponse.json({ removed: true });
}

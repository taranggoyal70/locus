import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { generateApiKey, hashKey } from "@/lib/api-auth";
import { readLimitedJson, sameOriginMutation } from "@/lib/request-security";
import { tenantDb } from "@/lib/db";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const keys = await tenantDb(userId)
      .selectFrom("api_keys")
      .select(["id", "name", "prefix", "last_used_at", "created_at"])
      .where("user_id", "=", userId)
      .orderBy("created_at", "desc")
      .execute();
    return NextResponse.json({ keys });
  } catch {
    return NextResponse.json({ error: "Failed to load keys." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sameOriginMutation(request)) {
    return NextResponse.json({ error: "Cross-site requests are not allowed." }, { status: 403 });
  }

  const parsed = await readLimitedJson<{ name?: string }>(request, 1_024);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = parsed.value;
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }

  const name = (body.name ?? "").trim() || "Untitled key";
  if (name.length > 100) {
    return NextResponse.json({ error: "Name too long." }, { status: 400 });
  }

  const db = tenantDb(userId);
  const KEY_LIMIT = 5;
  const rawKey = generateApiKey();
  const keyHash = await hashKey(rawKey);
  const prefix = rawKey.slice(0, 10);

  try {
    // An unreadable count is a failure, not zero: treating it as zero would
    // let a database hiccup lift the key limit.
    const { count } = await db
      .selectFrom("api_keys")
      .select((eb) => eb.fn.countAll<number>().as("count"))
      .where("user_id", "=", userId)
      .executeTakeFirstOrThrow();
    if (Number(count) >= KEY_LIMIT) {
      return NextResponse.json({ error: `Maximum ${KEY_LIMIT} API keys on the free plan.` }, { status: 400 });
    }

    await db.insertInto("api_keys").values({
      user_id: userId,
      name,
      key_hash: keyHash,
      prefix,
    }).execute();
  } catch {
    return NextResponse.json({ error: "Failed to create key." }, { status: 500 });
  }

  return NextResponse.json({ key: rawKey, prefix, name }, { status: 201 });
}

export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sameOriginMutation(request)) {
    return NextResponse.json({ error: "Cross-site requests are not allowed." }, { status: 403 });
  }

  const url = new URL(request.url);
  const keyId = url.searchParams.get("id");
  if (!keyId) return NextResponse.json({ error: "id is required." }, { status: 400 });

  try {
    await tenantDb(userId)
      .deleteFrom("api_keys")
      .where("id", "=", keyId)
      .where("user_id", "=", userId)
      .execute();
  } catch {
    // Includes a malformed id: the column is a uuid, and the database refuses
    // to compare it with anything else.
    return NextResponse.json({ error: "Failed to delete key." }, { status: 500 });
  }
  return NextResponse.json({ deleted: true });
}

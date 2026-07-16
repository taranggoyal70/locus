import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { generateApiKey, hashKey } from "@/lib/api-auth";
import { serviceClient } from "@/lib/supabase";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = serviceClient();
  const { data, error } = await db
    .from("api_keys")
    .select("id, name, prefix, last_used_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "Failed to load keys." }, { status: 500 });
  return NextResponse.json({ keys: data });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const name = (body.name ?? "").trim() || "Untitled key";
  if (name.length > 100) {
    return NextResponse.json({ error: "Name too long." }, { status: 400 });
  }

  const db = serviceClient();

  const { count } = await db
    .from("api_keys")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if ((count ?? 0) >= 10) {
    return NextResponse.json({ error: "Maximum 10 API keys allowed." }, { status: 400 });
  }

  const rawKey = generateApiKey();
  const keyHash = await hashKey(rawKey);
  const prefix = rawKey.slice(0, 10);

  const { error } = await db.from("api_keys").insert({
    user_id: userId,
    name,
    key_hash: keyHash,
    prefix,
  });

  if (error) return NextResponse.json({ error: "Failed to create key." }, { status: 500 });

  return NextResponse.json({ key: rawKey, prefix, name }, { status: 201 });
}

export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const keyId = url.searchParams.get("id");
  if (!keyId) return NextResponse.json({ error: "id is required." }, { status: 400 });

  const db = serviceClient();
  const { error } = await db
    .from("api_keys")
    .delete()
    .eq("id", keyId)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: "Failed to delete key." }, { status: 500 });
  return NextResponse.json({ deleted: true });
}

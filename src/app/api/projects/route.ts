import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { readLimitedJson, sameOriginMutation } from "@/lib/request-security";
import { serviceClient } from "@/lib/supabase";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = serviceClient();
  const { data, error } = await db
    .from("projects")
    .select("id, name, repo_url, task, slice_files, total_files, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: "Failed to load projects." }, { status: 500 });
  return NextResponse.json({ projects: data });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sameOriginMutation(request)) {
    return NextResponse.json({ error: "Cross-site requests are not allowed." }, { status: 403 });
  }

  const parsed = await readLimitedJson<{
    name: string;
    repo_url: string;
    task: string;
    slice_files: number;
    total_files: number;
  }>(request, 4_096);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = parsed.value;
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }

  if (!body.name || !body.repo_url || !body.task) {
    return NextResponse.json({ error: "name, repo_url, and task are required." }, { status: 400 });
  }

  const db = serviceClient();

  const PROJECT_LIMIT = 10;
  const { count } = await db
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if ((count ?? 0) >= PROJECT_LIMIT) {
    return NextResponse.json({ error: `Maximum ${PROJECT_LIMIT} saved analyses on the free plan. Delete older ones to save new.` }, { status: 400 });
  }

  const { data, error } = await db
    .from("projects")
    .insert({
      user_id: userId,
      name: body.name.slice(0, 200),
      repo_url: body.repo_url.slice(0, 500),
      task: body.task.slice(0, 500),
      slice_files: Math.max(0, Math.round(body.slice_files || 0)),
      total_files: Math.max(0, Math.round(body.total_files || 0)),
      saved_pct: 0,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: "Failed to save project." }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}

export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sameOriginMutation(request)) {
    return NextResponse.json({ error: "Cross-site requests are not allowed." }, { status: 403 });
  }

  const url = new URL(request.url);
  const projectId = url.searchParams.get("id");
  if (!projectId) return NextResponse.json({ error: "id is required." }, { status: 400 });

  const db = serviceClient();
  const { error } = await db
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: "Failed to delete project." }, { status: 500 });
  return NextResponse.json({ deleted: true });
}

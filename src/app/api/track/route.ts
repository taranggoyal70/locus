import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { track } from "@/lib/analytics";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({}, { status: 401 });

  let body: { event: string; properties?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({}, { status: 400 });
  }

  if (!body.event || typeof body.event !== "string") {
    return NextResponse.json({}, { status: 400 });
  }

  const allowed = ["context_copied", "task_analyzed", "project_saved"];
  if (!allowed.includes(body.event)) {
    return NextResponse.json({}, { status: 400 });
  }

  track({ event: body.event, userId, properties: (body.properties ?? {}) as Record<string, import("@/lib/database.types").Json> });
  return NextResponse.json({ ok: true });
}

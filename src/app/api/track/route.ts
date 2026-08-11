import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { track } from "@/lib/analytics";
import { filterEventProperties, isAllowedEvent } from "@/lib/analytics-events";
import { consumeRateLimit } from "@/lib/rate-limit";
import { readLimitedJson, sameOriginMutation } from "@/lib/request-security";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({}, { status: 401 });
  if (!sameOriginMutation(request)) return NextResponse.json({}, { status: 403 });

  const parsed = await readLimitedJson<{ event: string; properties?: Record<string, unknown> }>(request, 4_096);
  if (!parsed.ok) return NextResponse.json({}, { status: parsed.status });
  const body = parsed.value;
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({}, { status: 400 });
  }

  if (!body.event || typeof body.event !== "string") {
    return NextResponse.json({}, { status: 400 });
  }

  if (!isAllowedEvent(body.event)) {
    return NextResponse.json({}, { status: 400 });
  }

  let rate;
  try {
    rate = await consumeRateLimit({
      namespace: "analytics-event",
      identity: userId,
      limit: 120,
      windowSeconds: 60,
    });
  } catch {
    return NextResponse.json({}, { status: 503 });
  }
  if (!rate.allowed) {
    return NextResponse.json(
      {},
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  await track({ event: body.event, userId, properties: filterEventProperties(body.event, body.properties) });
  return NextResponse.json({ ok: true });
}

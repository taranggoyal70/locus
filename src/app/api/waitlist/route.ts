import { NextResponse } from "next/server";

import { consumeRateLimit } from "@/lib/rate-limit";
import { readLimitedJson, sameOriginMutation } from "@/lib/request-security";
import { serviceClient } from "@/lib/supabase";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BODY_BYTES = 2_048;

export async function POST(request: Request) {
  if (!sameOriginMutation(request)) {
    return NextResponse.json({ error: "Cross-site requests are not allowed." }, { status: 403 });
  }
  const parsed = await readLimitedJson(request, MAX_BODY_BYTES);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  const body = parsed.value;

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { email, name, company, use_case } = body as Record<string, unknown>;
  if (typeof email !== "string" || !EMAIL_RE.test(email) || email.length > 320) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  const trimmed = {
    email: email.toLowerCase().trim(),
    name: typeof name === "string" ? name.trim().slice(0, 200) : null,
    company: typeof company === "string" ? company.trim().slice(0, 200) : null,
    use_case: typeof use_case === "string" ? use_case.trim().slice(0, 1000) : null,
  };

  const identity = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
  let rate;
  try {
    rate = await consumeRateLimit({
      namespace: "waitlist-submit",
      identity,
      limit: 5,
      windowSeconds: 3_600,
    });
  } catch {
    return NextResponse.json({ error: "Submission limits could not be verified." }, { status: 503 });
  }
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many submissions. Try again later." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const db = serviceClient();
  const { error } = await db.from("waitlist").insert(trimmed);

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ ok: true, message: "You're already on the waitlist." });
    }
    return NextResponse.json({ error: "Failed to join waitlist." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: "You're on the list. We'll be in touch." });
}

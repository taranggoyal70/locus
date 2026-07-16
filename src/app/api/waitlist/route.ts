import { NextResponse } from "next/server";

import { serviceClient } from "@/lib/supabase";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

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

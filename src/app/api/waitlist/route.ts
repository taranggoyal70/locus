import { NextResponse } from "next/server";

import { serviceClient } from "@/lib/supabase";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BODY_BYTES = 5_000;
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 15 * 60_000;
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}

function allowedByRateLimit(request: Request): boolean {
  const now = Date.now();
  const key = clientIp(request);
  const current = rateLimits.get(key);
  const entry = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + RATE_WINDOW_MS }
    : current;
  entry.count += 1;
  rateLimits.set(key, entry);
  return entry.count <= RATE_LIMIT;
}

async function readLimitedBody(request: Request): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export async function POST(request: Request) {
  if (!allowedByRateLimit(request)) {
    return NextResponse.json({ error: "Too many waitlist requests. Try again later." }, { status: 429 });
  }
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "Cross-site requests are not allowed." }, { status: 403 });
  }
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
  }

  let body: unknown;
  const rawBody = await readLimitedBody(request);
  if (rawBody === null) {
    return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
  }
  try {
    body = JSON.parse(rawBody);
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

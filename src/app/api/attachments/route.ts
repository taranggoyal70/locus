import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { extractAttachment, MAX_ATTACHMENT_BYTES } from "@/lib/attachments";
import { consumeRateLimit } from "@/lib/rate-limit";
import { readLimitedBody, sameOriginMutation } from "@/lib/request-security";

export const runtime = "nodejs";
export const maxDuration = 15;

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  if (!sameOriginMutation(request)) {
    return NextResponse.json({ error: "Cross-site requests are not allowed." }, { status: 403 });
  }
  let rate;
  try {
    rate = await consumeRateLimit({
      namespace: "attachment-extract",
      identity: userId,
      limit: 10,
      windowSeconds: 60,
    });
  } catch {
    return NextResponse.json({ error: "Upload limits could not be verified." }, { status: 503 });
  }
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many attachments. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) {
    return NextResponse.json({ error: "Upload one attachment as multipart form data." }, { status: 415 });
  }
  try {
    const body = await readLimitedBody(request, MAX_ATTACHMENT_BYTES + 100_000);
    if (!body.ok) {
      return NextResponse.json(
        { error: body.status === 413 ? "Attachments must be smaller than 4 MB." : body.error },
        { status: body.status },
      );
    }
    const boundedRequest = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: body.value as BodyInit,
    });
    const form = await boundedRequest.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose a document to attach." }, { status: 400 });
    }
    const attachment = await extractAttachment(file);
    return NextResponse.json(
      { attachment },
      { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read this attachment.";
    const clientError = /smaller|empty|valid|limited|Upload|readable|shorter|unsupported/i.test(message);
    console.error("Attachment extraction failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message,
    });
    return NextResponse.json(
      { error: clientError ? message : "Could not read this attachment. Try another file." },
      { status: clientError ? 400 : 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

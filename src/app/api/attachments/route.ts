import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { extractAttachment, MAX_ATTACHMENT_BYTES } from "@/lib/attachments";

export const runtime = "nodejs";
export const maxDuration = 15;

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "Cross-site requests are not allowed." }, { status: 403 });
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) {
    return NextResponse.json({ error: "Upload one attachment as multipart form data." }, { status: 415 });
  }
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_ATTACHMENT_BYTES + 100_000) {
    return NextResponse.json({ error: "Attachments must be smaller than 4 MB." }, { status: 413 });
  }

  try {
    const form = await request.formData();
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

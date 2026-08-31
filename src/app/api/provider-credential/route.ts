import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import {
  deleteCloudflareCredential,
  cloudflareCredentialStatus,
  saveCloudflareCredential,
} from "@/lib/agent/provider-credential-store";
import { parseCloudflareCredentialInput } from "@/lib/agent/provider-credential";
import { readLimitedJson, sameOriginMutation } from "@/lib/request-security";

const MAX_CREDENTIAL_BODY_BYTES = 2_048;

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  try {
    return NextResponse.json(await cloudflareCredentialStatus(userId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "Could not read provider connection." }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!sameOriginMutation(request)) {
    return NextResponse.json({ error: "Cross-site requests are not allowed." }, { status: 403 });
  }
  const parsed = await readLimitedJson(request, MAX_CREDENTIAL_BODY_BYTES);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  try {
    const credential = parseCloudflareCredentialInput(
      parsed.value && typeof parsed.value === "object"
        ? parsed.value as Record<string, unknown>
        : {},
    );
    await saveCloudflareCredential({ userId, credential });
    return NextResponse.json({ configured: true, accountIdSuffix: credential.accountId.slice(-6) });
  } catch (error) {
    const message = error instanceof Error && (
      error.message.includes("Cloudflare Account ID")
      || error.message.includes("Cloudflare API token")
    )
      ? error.message
      : "Could not save provider connection.";
    return NextResponse.json({ error: message }, { status: message.startsWith("Could not") ? 503 : 400 });
  }
}

export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!sameOriginMutation(request)) {
    return NextResponse.json({ error: "Cross-site requests are not allowed." }, { status: 403 });
  }
  try {
    await deleteCloudflareCredential(userId);
    return NextResponse.json({ configured: false, accountIdSuffix: null });
  } catch {
    return NextResponse.json({ error: "Could not remove provider connection." }, { status: 503 });
  }
}

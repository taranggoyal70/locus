import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { alphaCapabilitiesForUser } from "@/lib/alpha-capabilities";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!alphaCapabilitiesForUser(userId).billing) {
    return NextResponse.json(
      { error: "Billing is unavailable during early access." },
      { status: 403 },
    );
  }

  return NextResponse.json({ plan: "alpha", status: "active" });
}

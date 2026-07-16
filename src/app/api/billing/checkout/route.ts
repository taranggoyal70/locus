import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { PLANS, stripe } from "@/lib/stripe";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const priceId = PLANS.pro.priceId;
  if (!priceId) {
    return NextResponse.json({ error: "Billing is not configured." }, { status: 503 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${siteUrl}/settings?billing=success`,
    cancel_url: `${siteUrl}/settings?billing=cancelled`,
    client_reference_id: userId,
    metadata: { userId },
  });

  return NextResponse.json({ url: session.url });
}

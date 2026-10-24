import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { accountCan } from "@/lib/admission-server";
import { stripe } from "@/lib/stripe";
import { tenantClient } from "@/lib/supabase-tenant";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await accountCan(userId, "billing"))) {
    return NextResponse.json(
      { error: "Billing is disabled during early access." },
      { status: 403 },
    );
  }

  const db = tenantClient(userId);
  const { data } = await db
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .single();

  if (!data?.stripe_customer_id) {
    return NextResponse.json({ error: "No active subscription." }, { status: 404 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const session = await stripe().billingPortal.sessions.create({
    customer: data.stripe_customer_id,
    return_url: `${siteUrl}/settings`,
  });

  return NextResponse.json({ url: session.url });
}

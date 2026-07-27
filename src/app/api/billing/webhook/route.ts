import { NextResponse } from "next/server";

import { stripe } from "@/lib/stripe";
import { serviceClient } from "@/lib/supabase";

export async function POST(request: Request) {
  const sig = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: "Missing signature or webhook secret." }, { status: 400 });
  }

  const body = await request.text();
  let event;
  try {
    event = stripe().webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    const db = serviceClient();

    switch (event.type) {
      case "checkout.session.completed": {
        // New checkout is closed during the public beta. Do not grant an
        // entitlement from a previously issued or replayed Checkout Session.
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object;
        const { data, error: lookupError } = await db
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_subscription_id", sub.id)
          .maybeSingle();
        if (lookupError) throw lookupError;
        if (data) {
          const { error } = await db.from("subscriptions").update({
            status: sub.status === "active" ? "active" : "inactive",
          }).eq("user_id", data.user_id);
          if (error) throw error;
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const { error } = await db.from("subscriptions").update({
          status: "cancelled",
          plan: "free",
        }).eq("stripe_subscription_id", sub.id);
        if (error) throw error;
        break;
      }
    }
  } catch {
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

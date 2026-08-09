import { NextResponse } from "next/server";

import { readLimitedBody } from "@/lib/request-security";
import { stripe } from "@/lib/stripe";
import { globalClient } from "@/lib/supabase-tenant";

// Stripe event payloads are small; the largest realistic ones are well under
// 64 KB. This is a denial-of-service ceiling, not a schema limit.
const MAX_WEBHOOK_BODY_BYTES = 256 * 1024;

export async function POST(request: Request) {
  const sig = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: "Missing signature or webhook secret." }, { status: 400 });
  }

  // R17: request.text() buffered whatever arrived. Signature verification
  // happens after the body is read, so an unauthenticated caller who merely
  // knows the endpoint URL could stream an arbitrarily large body and have it
  // held in memory before ever being rejected. The ceiling has to sit in front
  // of the read, not after it.
  //
  // The raw bytes are needed verbatim for signature verification, so this uses
  // the bounded reader rather than the JSON helper.
  const raw = await readLimitedBody(request, MAX_WEBHOOK_BODY_BYTES);
  if (!raw.ok) {
    return NextResponse.json({ error: raw.error }, { status: raw.status });
  }
  const body = new TextDecoder().decode(raw.value);

  let event;
  try {
    event = stripe().webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const db = globalClient("Stripe webhook has no authenticated user");

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.metadata?.userId ?? session.client_reference_id;
      if (!userId || !session.subscription || !session.customer) break;

      await db.from("subscriptions").upsert({
        user_id: userId,
        stripe_customer_id: String(session.customer),
        stripe_subscription_id: String(session.subscription),
        plan: "pro",
        status: "active",
      }, { onConflict: "user_id" });
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object;
      const { data } = await db
        .from("subscriptions")
        .select("user_id")
        .eq("stripe_subscription_id", sub.id)
        .single();
      if (data) {
        await db.from("subscriptions").update({
          status: sub.status === "active" ? "active" : "inactive",
        }).eq("user_id", data.user_id);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object;
      await db.from("subscriptions").update({
        status: "cancelled",
        plan: "free",
      }).eq("stripe_subscription_id", sub.id);
      break;
    }
  }

  return NextResponse.json({ received: true });
}

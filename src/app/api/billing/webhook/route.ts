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

  // R17: Stripe does not guarantee delivery order, and it retries deliveries
  // concurrently. Each handler below was individually idempotent — replaying one
  // wrote the same values — so duplicate delivery was never the live risk. Stale
  // delivery was: a delayed `customer.subscription.updated` carrying
  // `status: active` arriving after `customer.subscription.deleted` restored paid
  // access to a cancelled account, which is reproducible against this schema.
  //
  // Every write now goes through a function that refuses an event older than, or
  // identical to, the one already applied to that row. The comparison and the
  // write are one statement, because reading the watermark here and then writing
  // would be the same race closed in migration 016.
  const eventCreatedAt = new Date(event.created * 1_000).toISOString();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.metadata?.userId ?? session.client_reference_id;
      if (!userId || !session.subscription || !session.customer) break;

      await db.rpc("upsert_stripe_subscription", {
        p_user_id: userId,
        p_customer_id: String(session.customer),
        p_subscription_id: String(session.subscription),
        p_plan: "pro",
        p_status: "active",
        p_event_id: event.id,
        p_event_created: eventCreatedAt,
      });
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object;
      await db.rpc("apply_stripe_subscription_event", {
        p_subscription_id: sub.id,
        p_status: sub.status === "active" ? "active" : "inactive",
        // The plan is not part of this event, so it is left as it is rather than
        // being guessed from the status.
        p_plan: null,
        p_event_id: event.id,
        p_event_created: eventCreatedAt,
      });
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object;
      await db.rpc("apply_stripe_subscription_event", {
        p_subscription_id: sub.id,
        p_status: "cancelled",
        p_plan: "free",
        p_event_id: event.id,
        p_event_created: eventCreatedAt,
      });
      break;
    }
  }

  // Acknowledged whether or not the event changed anything: a refused stale or
  // duplicate event was handled correctly, and a non-2xx would make Stripe retry
  // it forever.
  return NextResponse.json({ received: true });
}

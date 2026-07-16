import type { Json } from "@/lib/database.types";

type EventPayload = {
  event: string;
  userId?: string;
  properties?: Record<string, Json>;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function track({ event, userId, properties = {} }: EventPayload) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;

  try {
    await fetch(`${SUPABASE_URL}/rest/v1/events`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        event,
        user_id: userId ?? null,
        properties,
      }),
    });
  } catch {
    // analytics must never break the product
  }
}

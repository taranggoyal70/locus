import { serviceClient } from "@/lib/supabase";

export type ApiKeyInfo = {
  userId: string;
  keyId: string;
};

export async function authenticateApiKey(request: Request): Promise<ApiKeyInfo | null> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer lk_")) return null;

  const token = header.slice(7);
  const hash = await hashKey(token);

  try {
    const db = serviceClient();
    const { data } = await db
      .from("api_keys")
      .select("id, user_id")
      .eq("key_hash", hash)
      .single();

    if (!data) return null;

    db.from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", data.id)
      .then();

    return { userId: data.user_id, keyId: data.id };
  } catch {
    return null;
  }
}

export async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const raw = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `lk_${raw}`;
}

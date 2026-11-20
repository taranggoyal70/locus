import { globalDb } from "@/lib/db";

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
    // The key is the credential: nobody is authenticated yet, so the lookup
    // cannot be scoped to a user. It matches one hash and returns one owner.
    const db = globalDb("API key lookup establishes the user");
    const rows = await db
      .selectFrom("api_keys")
      .select(["id", "user_id"])
      .where("key_hash", "=", hash)
      .limit(2)
      .execute();

    // Exactly one match, as before: an ambiguous hash authenticates nobody.
    if (rows.length !== 1) return null;
    const [key] = rows;

    // Best effort and off the request path. Kysely rejects where the old client
    // resolved with an error, so the catch is what keeps a failed timestamp
    // write from becoming an unhandled rejection.
    void db
      .updateTable("api_keys")
      .set({ last_used_at: new Date().toISOString() })
      .where("id", "=", key.id)
      .execute()
      .catch(() => {});

    return { userId: key.user_id, keyId: key.id };
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

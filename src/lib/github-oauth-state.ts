import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_STATE_AGE_MS = 10 * 60 * 1_000;

function signature(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createGitHubOAuthState(
  userId: string,
  secret: string,
  now = Date.now(),
): string {
  if (!userId || !secret) throw new Error("GitHub OAuth state cannot be created");
  const payload = Buffer.from(JSON.stringify({ userId, issuedAt: now })).toString("base64url");
  return `${payload}.${signature(payload, secret)}`;
}

export function verifyGitHubOAuthState(
  state: string,
  expectedUserId: string,
  secret: string,
  now = Date.now(),
): boolean {
  const [payload, providedSignature, extra] = state.split(".");
  if (!payload || !providedSignature || extra || !expectedUserId || !secret) return false;
  const expectedSignature = signature(payload, secret);
  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return false;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      userId?: unknown;
      issuedAt?: unknown;
    };
    return parsed.userId === expectedUserId
      && typeof parsed.issuedAt === "number"
      && parsed.issuedAt <= now + 60_000
      && now - parsed.issuedAt <= MAX_STATE_AGE_MS;
  } catch {
    return false;
  }
}

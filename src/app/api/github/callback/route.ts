import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { admissionForAccount } from "@/lib/admission-server";
import { verifyGitHubOAuthState } from "@/lib/github-oauth-state";
import { tenantClient } from "@/lib/supabase-tenant";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.redirect(new URL("/sign-in", request.url));
  if (!(await admissionForAccount(userId)).capabilities.githubConnect) {
    return NextResponse.redirect(new URL("/settings?error=github_alpha_disabled", request.url));
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(new URL("/settings?error=github_missing_code", request.url));
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/settings?error=github_not_configured", request.url));
  }
  if (!verifyGitHubOAuthState(state, userId, clientSecret)) {
    return NextResponse.redirect(new URL("/settings?error=github_invalid_state", request.url));
  }

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL("/settings?error=github_token_failed", request.url));
  }

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    return NextResponse.redirect(new URL("/settings?error=github_no_token", request.url));
  }

  const userRes = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: "application/vnd.github+json" },
  });
  const ghUser = userRes.ok ? await userRes.json() : null;
  const username = ghUser?.login ?? "unknown";

  const db = tenantClient(userId);
  await db
    .from("github_connections")
    .upsert({
      user_id: userId,
      github_username: username,
      access_token: tokenData.access_token,
      scopes: tokenData.scope ?? "",
    }, { onConflict: "user_id" });

  return NextResponse.redirect(new URL("/settings?github=connected", request.url));
}

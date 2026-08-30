import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { alphaCapabilitiesForUser } from "@/lib/alpha-capabilities";
import { createGitHubOAuthState } from "@/lib/github-oauth-state";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!alphaCapabilitiesForUser(userId).githubConnect) {
    return NextResponse.json(
      { error: "GitHub connections are not available during early access." },
      { status: 403 },
    );
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: "GitHub OAuth is not configured." }, { status: 503 });
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/github/callback`;
  const state = createGitHubOAuthState(userId, clientSecret);

  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "repo");
  url.searchParams.set("state", state);

  return NextResponse.redirect(url.toString());
}

import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { sameOriginMutation } from "@/lib/request-security";

export function isProtectedPagePathname(pathname: string): boolean {
  return ["/workspace", "/demo", "/settings", "/projects"].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isProtectedPathname(pathname: string): boolean {
  if (pathname === "/api/billing/webhook") return false;
  return isProtectedPagePathname(pathname) || ["/api/github", "/api/agent", "/api/attachments", "/api/keys", "/api/projects", "/api/usage", "/api/track", "/api/teams", "/api/billing", "/repos"].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function shouldRejectProtectedMutation(request: Request): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) return false;
  return isProtectedPathname(new URL(request.url).pathname) && !sameOriginMutation(request);
}

export default clerkMiddleware(
  async (auth, request) => {
    const pathname = request.nextUrl.pathname;
    if (shouldRejectProtectedMutation(request)) {
      return NextResponse.json(
        { error: "Cross-site requests are not allowed." },
        { status: 403 },
      );
    }
    if (isProtectedPagePathname(pathname)) {
      const signInUrl = new URL("/sign-in", request.url);
      signInUrl.searchParams.set("redirect_url", request.url);
      await auth.protect({ unauthenticatedUrl: signInUrl.toString() });
    } else if (isProtectedPathname(pathname)) {
      await auth.protect();
    }
  },
  {
    frontendApiProxy: { enabled: process.env.NODE_ENV === "production" },
    contentSecurityPolicy: {
      strict: true,
      directives: {
        "base-uri": ["'self'"],
        "frame-ancestors": ["'none'"],
        "object-src": ["'none'"],
      },
    },
  },
);

export const config = {
  matcher: [
    "/__clerk(.*)",
    "/((?!_next|\\.well-known/workflow/|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

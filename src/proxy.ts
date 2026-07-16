import { clerkMiddleware } from "@clerk/nextjs/server";

export function isProtectedPagePathname(pathname: string): boolean {
  return pathname === "/" || ["/workspace", "/demo", "/settings", "/projects"].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isProtectedPathname(pathname: string): boolean {
  return isProtectedPagePathname(pathname) || ["/api/github", "/api/attachments", "/api/keys", "/api/projects", "/api/usage", "/api/track", "/repos"].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export default clerkMiddleware(
  async (auth, request) => {
    const pathname = request.nextUrl.pathname;
    if (isProtectedPagePathname(pathname)) {
      const signInUrl = new URL("/sign-in", request.url);
      signInUrl.searchParams.set("redirect_url", request.url);
      await auth.protect({ unauthenticatedUrl: signInUrl.toString() });
    } else if (isProtectedPathname(pathname)) {
      await auth.protect();
    }
  },
  { frontendApiProxy: { enabled: process.env.NODE_ENV === "production" } },
);

export const config = {
  matcher: [
    "/__clerk(.*)",
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

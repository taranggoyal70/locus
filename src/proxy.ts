import { clerkMiddleware } from "@clerk/nextjs/server";

export function isProtectedPathname(pathname: string): boolean {
  return pathname === "/" || ["/workspace", "/demo", "/api/github", "/repos"].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export default clerkMiddleware(
  async (auth, request) => {
    if (isProtectedPathname(request.nextUrl.pathname)) await auth.protect();
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

/**
 * R16: security headers as data, so drift is a failing test rather than a
 * silent regression.
 *
 * These previously lived inline in next.config.ts, where nothing asserted them.
 * A header dropped during an unrelated config edit would weaken the browser
 * surface with no signal at all, which is exactly the "configuration drift"
 * the review flags. Keeping them here lets the suite pin both the set and each
 * value.
 */
export type SecurityHeader = { key: string; value: string };

export const securityHeaders: readonly SecurityHeader[] = [
  // Locus renders no third-party frames and should never be framed itself.
  { key: "X-Frame-Options", value: "DENY" },
  // Stops a browser re-interpreting an API response as HTML or script.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Keeps full URLs, which can carry repository and task identifiers, from
  // reaching third-party origins.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

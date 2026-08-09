import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

// R16: pinned and asserted in src/lib/security-headers.test.ts so a dropped
// header fails the build rather than silently weakening the browser surface.
import { securityHeaders } from "./src/lib/security-headers";


const nextConfig: NextConfig = {
  reactCompiler: true,
  poweredByHeader: false,
  async headers() {
    // Next expects a mutable Header[]; the exported list stays readonly so a
    // caller cannot mutate the pinned set.
    return [{ source: "/(.*)", headers: [...securityHeaders] }];
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default withWorkflow(nextConfig);

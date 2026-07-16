import { describe, expect, it } from "vitest";

import { isProtectedPagePathname, isProtectedPathname } from "@/proxy";

describe("authenticated product routes", () => {
  it("protects every product entry while leaving authentication pages public", () => {
    for (const path of ["/", "/workspace", "/workspace/settings", "/demo", "/settings", "/projects", "/api/github", "/api/attachments", "/api/keys", "/api/projects", "/api/usage", "/repos/taxonomy.json"]) {
      expect(isProtectedPathname(path), path).toBe(true);
    }
    for (const path of ["/sign-in", "/sign-up", "/icon.svg", "/api/v1/locate", "/api/health", "/docs"]) {
      expect(isProtectedPathname(path), path).toBe(false);
    }
  });

  it("routes signed-out browser pages through the branded account flow", () => {
    for (const path of ["/", "/workspace", "/workspace/settings", "/demo", "/settings", "/projects"]) {
      expect(isProtectedPagePathname(path), path).toBe(true);
    }
    for (const path of ["/sign-in", "/api/github", "/repos/taxonomy.json", "/docs"]) {
      expect(isProtectedPagePathname(path), path).toBe(false);
    }
  });
});

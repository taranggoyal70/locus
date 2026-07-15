import { describe, expect, it } from "vitest";

import { isProtectedPagePathname, isProtectedPathname } from "@/proxy";

describe("authenticated product routes", () => {
  it("protects every product entry while leaving authentication pages public", () => {
    for (const path of ["/", "/workspace", "/workspace/settings", "/demo", "/api/github", "/repos/taxonomy.json"]) {
      expect(isProtectedPathname(path), path).toBe(true);
    }
    for (const path of ["/sign-in", "/sign-up", "/icon.svg", "/api/unrelated"]) {
      expect(isProtectedPathname(path), path).toBe(false);
    }
  });

  it("routes signed-out browser pages through the branded account flow", () => {
    for (const path of ["/", "/workspace", "/workspace/settings", "/demo"]) {
      expect(isProtectedPagePathname(path), path).toBe(true);
    }
    for (const path of ["/sign-in", "/api/github", "/repos/taxonomy.json"]) {
      expect(isProtectedPagePathname(path), path).toBe(false);
    }
  });
});

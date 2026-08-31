import { describe, expect, it } from "vitest";

import { findBannedAlphaClaims, isPublicSurfacePath } from "./check-alpha-claims.mjs";

describe("findBannedAlphaClaims", () => {
  it("reports unsupported public promises with their source", () => {
    expect(
      findBannedAlphaClaims([
        { path: "pricing.tsx", content: "Private repositories for $29" },
      ]),
    ).toEqual([
      "pricing.tsx: paid price",
      "pricing.tsx: private repository support",
    ]);
  });

  it("discovers nested pages, API responses, and rendered components", () => {
    expect(isPublicSurfacePath("src/app/sign-in/[[...sign-in]]/page.tsx")).toBe(true);
    expect(isPublicSurfacePath("src/app/api/v1/locate/route.ts")).toBe(true);
    expect(isPublicSurfacePath("src/components/nested/Outcome.tsx")).toBe(true);
    expect(isPublicSurfacePath("src/components/Outcome.test.tsx")).toBe(false);
  });

  it("rejects generic percentage-savings outcomes", () => {
    expect(findBannedAlphaClaims([
      { path: "workspace.tsx", content: "74% saved" },
      { path: "meter.tsx", content: "62% fewer tokens" },
    ])).toEqual([
      "workspace.tsx: unsupported percentage savings",
      "meter.tsx: unsupported percentage token reduction",
    ]);
  });

  it("rejects unreleased delivery and upgrade promises", () => {
    expect(findBannedAlphaClaims([
      { path: "auth.tsx", content: "approve verified delivery" },
      { path: "pricing.tsx", content: "Upgrade for private repos" },
    ])).toEqual([
      "auth.tsx: verified delivery",
      "pricing.tsx: unreleased upgrade",
    ]);
  });

  it("accepts bounded beta language without treating it as an outcome claim", () => {
    expect(
      findBannedAlphaClaims([
        {
          path: "landing.tsx",
          content: "Limited public beta: one shared Agent Run per UTC day.",
        },
      ]),
    ).toEqual([]);
  });
});

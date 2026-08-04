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

  it("accepts controlled-alpha language", () => {
    expect(
      findBannedAlphaClaims([
        {
          path: "landing.tsx",
          content: "Controlled alpha for review-ready proposals.",
        },
      ]),
    ).toEqual([]);
  });
});

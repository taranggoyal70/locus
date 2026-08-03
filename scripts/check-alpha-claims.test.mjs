import { describe, expect, it } from "vitest";

import { findBannedAlphaClaims } from "./check-alpha-claims.mjs";

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

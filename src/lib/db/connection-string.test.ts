import { describe, expect, it } from "vitest";

import { withVerifiedTls } from "../../../db/connection-string.mjs";

describe("withVerifiedTls", () => {
  it.each(["prefer", "require", "verify-ca"])("states sslmode=%s as the verify-full it already gets", (mode) => {
    expect(withVerifiedTls(`postgresql://u:p@ep-x.neon.tech/neondb?sslmode=${mode}&channel_binding=require`))
      .toBe("postgresql://u:p@ep-x.neon.tech/neondb?sslmode=verify-full&channel_binding=require");
  });

  it.each([
    "postgres://postgres:postgres@localhost:5432/locus",
    "postgres://postgres:postgres@localhost:5432/locus?sslmode=disable",
    "postgresql://u:p@ep-x.neon.tech/neondb?sslmode=verify-full",
  ])("leaves %s alone", (url) => {
    expect(withVerifiedTls(url)).toBe(url);
  });
});

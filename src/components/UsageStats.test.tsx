import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { UsageStats } from "@/components/UsageStats";

describe("UsageStats", () => {
  it("renders a loading state rather than nothing on first paint", () => {
    // Server-rendered, before the fetch resolves.
    expect(renderToStaticMarkup(<UsageStats />)).toContain("skeleton");
  });
});

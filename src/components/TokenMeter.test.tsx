import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { packContext, TokenMeter } from "@/components/TokenMeter";
import type { LocateResult, RepoData } from "@/lib/types";

const result: LocateResult = {
  task: "fix checkout",
  widened: false,
  reason: "matched checkout",
  anchors: ["checkout.ts"],
  anchorPaths: ["src/checkout.ts"],
  slice: [{ path: "src/checkout.ts", rel: "checkout.ts", dist: 0, tokens: 25, recent: false }],
  excluded: ["reports.ts"],
  excludedPaths: ["src/reports.ts"],
  sliceTokens: 25,
  totalTokens: 100,
  savedPct: 75,
  refinement: null,
  edgeDensity: 1.5,
  sparse: false,
};

const repo: RepoData = {
  name: "fixture",
  slug: "fixture",
  description: "",
  root: "src",
  recentlyChanged: [],
  files: { "src/checkout.ts": "export const checkout = true" },
};

describe("controlled-alpha context token view", () => {
  it("shows factual included and total usage without a savings outcome", () => {
    const html = renderToStaticMarkup(<TokenMeter result={result} repo={repo} sparse={false} />);

    expect(html).toContain("25");
    expect(html).toContain("100");
    expect(html).toContain("included share");
    expect(html).not.toContain("fewer tokens");
    expect(html).not.toContain("−75%");
  });
});

describe("web packed context sparse warning", () => {
  const sparseResult: LocateResult = {
    ...result,
    edgeDensity: 0,
    sparse: true,
  };

  it("includes the sparse warning before generic file contents", () => {
    const packed = packContext(repo, sparseResult);

    expect(packed.text).toContain("# warning: few internal imports resolved (0.00 edges/file)");
    expect(packed.text.indexOf("# warning:")).toBeLessThan(packed.text.indexOf("===== src/checkout.ts ====="));
  });

  it("includes the sparse warning before Claude file contents", () => {
    const packed = packContext(repo, sparseResult, "claude");

    expect(packed.text).toContain("<!-- warning: few internal imports resolved (0.00 edges/file)");
    expect(packed.text.indexOf("<!-- warning:")).toBeLessThan(packed.text.indexOf("===== src/checkout.ts ====="));
  });

  it("includes the sparse warning before Cursor file contents", () => {
    const packed = packContext(repo, sparseResult, "cursor");

    expect(packed.text).toContain("// warning: few internal imports resolved (0.00 edges/file)");
    expect(packed.text.indexOf("// warning:")).toBeLessThan(packed.text.indexOf("// File: src/checkout.ts"));
  });

  it("omits the sparse warning when the result widened", () => {
    const packed = packContext(repo, { ...sparseResult, widened: true });

    expect(packed.text).not.toContain("warning:");
  });
});

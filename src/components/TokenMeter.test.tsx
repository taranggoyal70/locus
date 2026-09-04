import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { packContext, TokenMeter } from "@/components/TokenMeter";
import { buildGraph, locate } from "@/lib/localizer";
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

describe("sparse graph warning", () => {
  // The warning said the Slice "may stay broad", which is the opposite of what a
  // sparse graph means: fewer resolved imports make the Closure smaller, so the
  // Slice is too narrow and the reduction is overstated. The CLI and CONTEXT.md
  // both said so; only this surface disagreed, and it is the surface showing the
  // number the warning is about.
  const repo: RepoData = {
    name: "r", slug: "r", description: "", root: "",
    recentlyChanged: [],
    files: { "a.ts": "export const a = 1;", "b.ts": "export const b = 2;" },
  };
  const graph = buildGraph(repo);
  const result = locate("the a module", repo, graph);

  it("warns that the Slice may be missing dependencies, not that it is broad", () => {
    const html = renderToStaticMarkup(
      <TokenMeter result={{ ...result, widened: false, sparse: true }} repo={repo} sparse />,
    );
    expect(html).toContain("missing real dependencies");
    expect(html).toContain("overstated");
    expect(html).not.toContain("stay broad");
  });

  it("agrees with the wording the CLI prints for the same condition", () => {
    const html = renderToStaticMarkup(
      <TokenMeter result={{ ...result, widened: false, sparse: true }} repo={repo} sparse />,
    );
    for (const phrase of ["Few internal imports resolved", "missing real dependencies", "overstated"]) {
      expect(html).toContain(phrase);
    }
  });

  it("does not warn on a widened result", () => {
    // Widen already returns everything; the artifact warning is about a small
    // Slice that only looks small.
    const html = renderToStaticMarkup(
      <TokenMeter result={{ ...result, widened: true, sparse: true }} repo={repo} sparse />,
    );
    expect(html).not.toContain("missing real dependencies");
  });
});

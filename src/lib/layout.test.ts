import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { layoutGraph } from "@/lib/layout";
import { buildGraph } from "@/lib/localizer";
import type { RepoData } from "@/lib/types";

const repo: RepoData = JSON.parse(readFileSync("test/fixtures/studentpulse.json", "utf8"));
const graph = buildGraph(repo);

// Extracting layout from the React component made its geometry testable directly.
describe("layoutGraph", () => {
  it("positions every node and sizes the canvas", () => {
    const l = layoutGraph(graph.nodes);
    for (const n of graph.nodes) expect(l.pos[n.rel]).toBeDefined();
    expect(l.W).toBeGreaterThan(0);
    expect(l.H).toBeGreaterThan(0);
  });

  it("orders columns by dependency flow and matches colX", () => {
    const l = layoutGraph(graph.nodes);
    expect(l.cols).toContain("app");
    expect(l.cols).toContain("lib");
    expect(l.cols.indexOf("app")).toBeLessThan(l.cols.indexOf("lib"));
    expect(l.colX).toHaveLength(l.cols.length);
  });
});

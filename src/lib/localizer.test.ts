import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { buildGraph, locate } from "@/lib/localizer";
import type { RepoData } from "@/lib/types";

const repo: RepoData = JSON.parse(readFileSync("test/fixtures/studentpulse.json", "utf8"));
const graph = buildGraph(repo);

// The interface IS the test surface — assert on LocateResult, not internals.
describe("locate", () => {
  it("localizes a dashboard task to its slice and excludes other features", () => {
    const r = locate("the dashboard chart is broken", repo, graph);
    expect(r.widened).toBe(false);
    expect(r.anchors).toContain("app/dashboard/page.tsx");
    expect(r.savedPct).toBeGreaterThan(50);

    const rels = r.slice.map((s) => s.rel);
    expect(rels).toContain("app/dashboard/page.tsx");
    // cohorts / reports / roster code is not in a dashboard slice
    expect(rels).not.toContain("app/cohorts/page.tsx");
    expect(rels).not.toContain("components/CohortTable.tsx");
    expect(r.excluded).toContain("app/reports/page.tsx");
  });

  it("surfaces a recently-changed shared file to the top (cross-cutting)", () => {
    const r = locate("dashboard shows the wrong dates", repo, graph);
    expect(r.slice[0].recent).toBe(true); // date.ts / chart floated up
    expect(r.slice.some((s) => s.rel === "lib/date.ts" && s.recent)).toBe(true);
  });

  it("widens to the whole repo when nothing anchors (never a silent miss)", () => {
    const r = locate("make the checkout flow faster", repo, graph);
    expect(r.widened).toBe(true);
    expect(r.excluded).toHaveLength(0);
    expect(r.slice.length).toBe(graph.nodes.length);
    expect(r.savedPct).toBe(0);
  });

  it("widens on vague / conversational input instead of inventing an anchor", () => {
    for (const vague of ["help me", "fix this", "hey", "something is off", "can you help"]) {
      const r = locate(vague, repo, graph);
      expect(r.widened, `"${vague}" should widen`).toBe(true);
      expect(r.savedPct).toBe(0);
    }
  });

  it("can anchor a concrete task directly on a non-page module", () => {
    const r = locate("fix date formatting timezone", repo, graph);
    expect(r.widened).toBe(false);
    expect(r.anchors).toContain("lib/date.ts");
    expect(r.slice.some((file) => file.rel === "lib/date.ts")).toBe(true);
  });

  it("uses attached evidence to localize an otherwise vague task", () => {
    const r = locate("fix this", repo, graph, "The enrollment dashboard chart shows the wrong dates");
    expect(r.widened).toBe(false);
    expect(r.anchors).toContain("app/dashboard/page.tsx");
    expect(r.task).toBe("fix this");
  });
});

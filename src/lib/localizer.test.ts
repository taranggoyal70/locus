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
    // Preserve integration-point recall even when that costs a little more
    // context than the benchmark-wide median.
    expect(r.savedPct).toBeGreaterThan(40);

    const rels = r.slice.map((s) => s.rel);
    expect(rels).toContain("app/dashboard/page.tsx");
    // A page consuming a directly matched shared chart may be retained as an
    // integration point, but unrelated cohort/report implementation is not.
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

  it("explains which task terms were not found and suggests repository language", () => {
    const sceneGuardRepo: RepoData = {
      name: "sceneguard",
      slug: "sceneguard",
      description: "",
      root: "",
      recentlyChanged: [],
      files: {
        "server/authorization.js": "export function authorizeRequest() {}",
        "server/evidenceVault.js": "export function storeEvidence() {}",
        "src/app.js": "export function startApp() {}",
        "src/sceneEngine.js": "export function compareFrames() {}",
        "src/securityPolicy.js": "export const securityPolicy = {};",
      },
    };
    const result = locate(
      "the dashboard chart is broken",
      sceneGuardRepo,
      buildGraph(sceneGuardRepo),
    );

    expect(result.widened).toBe(true);
    expect(result.refinement?.unmatchedTerms).toEqual(["dashboard", "chart"]);
    expect(result.refinement?.repositoryTerms).toEqual(
      expect.arrayContaining(["authorization", "evidence", "scene", "security"]),
    );
    expect(result.refinement?.candidateFiles).toEqual([]);
  });

  it("splits camelCase file names so natural-language tasks can anchor them", () => {
    const camelRepo: RepoData = {
      name: "camel",
      slug: "camel",
      description: "",
      root: "src",
      recentlyChanged: [],
      files: {
        "src/sceneEngine.js": "export function compareFrames() {}",
        "src/securityPolicy.js": "export const securityPolicy = {};",
      },
    };
    const result = locate("fix the scene engine", camelRepo, buildGraph(camelRepo));

    expect(result.widened).toBe(false);
    expect(result.anchors).toContain("sceneEngine.js");
  });

  it("keeps a weak source match as guidance without treating it as a safe anchor", () => {
    const weakRepo: RepoData = {
      name: "weak",
      slug: "weak",
      description: "",
      root: "src",
      recentlyChanged: [],
      files: {
        "src/metrics.js": "export const dashboardMetric = 1;",
        "src/securityPolicy.js": "export const securityPolicy = {};",
      },
    };
    const result = locate("the dashboard chart is broken", weakRepo, buildGraph(weakRepo));

    expect(result.widened).toBe(true);
    expect(result.refinement?.candidateFiles).toEqual(["metrics.js"]);
    // "metrics.js" names no file in this repo; the openable spelling does.
    expect(result.refinement?.candidateFilePaths).toEqual(["src/metrics.js"]);
    expect(result.refinement?.unmatchedTerms).toEqual(["chart"]);
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

  it("keeps stronger non-surface anchors when a weaker matching page exists", () => {
    const webhookRepo: RepoData = {
      name: "webhook",
      slug: "webhook",
      description: "",
      root: "",
      recentlyChanged: ["scripts/setup-elevenlabs-agents.ts"],
      files: {
        "app/call/page.tsx": "export default function CallPage() { return null; }",
        "app/api/webhook/post-call/route.ts":
          "export async function POST(req: Request) { return req.json(); }",
        "scripts/setup-elevenlabs-agents.ts":
          "const postCallWebhook = { payload: true };",
      },
    };
    const result = locate(
      "fix the post-call webhook payload handling",
      webhookRepo,
      buildGraph(webhookRepo),
    );

    expect(result.slice.map((file) => file.rel)).toEqual(
      expect.arrayContaining([
        "app/api/webhook/post-call/route.ts",
        "scripts/setup-elevenlabs-agents.ts",
      ]),
    );
  });

  it("uses attached evidence to localize an otherwise vague task", () => {
    const r = locate("fix this", repo, graph, "The enrollment dashboard chart shows the wrong dates");
    expect(r.widened).toBe(false);
    expect(r.anchors).toContain("app/dashboard/page.tsx");
    expect(r.task).toBe("fix this");
  });
});

describe("buildGraph", () => {
  it("discovers edges from require() and dynamic import() calls", () => {
    const jsRepo: RepoData = {
      name: "test", slug: "test", description: "", root: "",
      recentlyChanged: [],
      files: {
        "app.js": 'const db = require("./db");\nimport("./utils").then(m => m.init());',
        "db.js": "export const connect = () => {};",
        "utils.js": "export const init = () => {};",
      },
    };
    const g = buildGraph(jsRepo);
    expect(g.nodes).toHaveLength(3);
    expect(g.deps["app.js"]).toContain("db.js");
    expect(g.deps["app.js"]).toContain("utils.js");
  });

  it("indexes .js and .jsx files alongside TypeScript", () => {
    const mixedRepo: RepoData = {
      name: "mixed", slug: "mixed", description: "", root: "src",
      recentlyChanged: [],
      files: {
        "src/app/page.tsx": 'import { Button } from "@/components/Button";',
        "src/components/Button.jsx": "export function Button() { return <button />; }",
        "src/lib/utils.js": "export const clamp = (n) => Math.max(0, n);",
      },
    };
    const g = buildGraph(mixedRepo);
    expect(g.nodes).toHaveLength(3);
    expect(g.deps["src/app/page.tsx"]).toContain("src/components/Button.jsx");
  });
});

// The web app and /api/v1/locate render these values for a human or an agent to
// open in a checkout, so "is it a real file in this repository" is the assertion
// that matters - a prefix check would pass on a path that still does not exist.
describe("openable paths", () => {
  it("emits repo-relative paths that resolve to real files", () => {
    // Guard: if the fixture ever loses its source root the two spellings become
    // identical and every assertion below would pass without proving anything.
    expect(repo.root).toBe("src");

    const result = locate("the dashboard chart is broken", repo, graph);
    const rendered = [
      ...result.anchorPaths,
      ...result.excludedPaths,
      ...result.slice.map((f) => f.path),
    ];

    expect(rendered.length).toBeGreaterThan(0);
    for (const candidate of rendered) {
      expect(Object.keys(repo.files)).toContain(candidate);
    }
    expect(result.anchorPaths).toContain("src/app/dashboard/page.tsx");
    expect(result.reason).toContain("src/app/dashboard/page.tsx");
  });

  it("keeps the source-root-relative spelling available for display", () => {
    const result = locate("the dashboard chart is broken", repo, graph);

    expect(result.anchors).toContain("app/dashboard/page.tsx");
    expect(result.slice.every((f) => f.path.endsWith(f.rel))).toBe(true);
  });
});

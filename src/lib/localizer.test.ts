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

  it("surfaces a recently-changed shared file above its peers (cross-cutting)", () => {
    // The cross-cutting case: date.ts is the shared util that broke the
    // dashboard, and it lives outside the obvious folder.
    //
    // This used to assert `slice[0].recent`, which encoded "recency outranks
    // everything" — including the Anchors. That is the property that let a task's
    // own subject fall out of a budgeted pack while unrelated recently-touched
    // files stayed in. What has to hold is that the culprit is surfaced, not that
    // it displaces the files the task actually named.
    const r = locate("dashboard shows the wrong dates", repo, graph);
    const culprit = r.slice.findIndex((s) => s.rel === "lib/date.ts");
    expect(culprit).toBeGreaterThanOrEqual(0);
    expect(r.slice[culprit].recent).toBe(true);

    // Above every non-recent file at the same distance, which is what "surfaced"
    // means once Anchors are excluded from the competition.
    const samePeers = r.slice
      .map((s, index) => ({ ...s, index }))
      .filter((s) => s.dist === r.slice[culprit].dist && !s.recent);
    for (const peer of samePeers) {
      expect(peer.index, `${peer.rel} must not outrank the recent date.ts`)
        .toBeGreaterThan(culprit);
    }
  });

  it("never lets a recently-changed file outrank an Anchor", () => {
    // The regression this ranking exists to prevent. Measured on this
    // repository before the fix: nine unrelated recently-touched files sorted
    // above four of six Anchors, and the Anchor the task was about fell outside
    // a 30,000-token pack while four of its test files stayed in. Ranking decides
    // what survives a budget, so it decides what the agent actually receives.
    const r = locate("dashboard shows the wrong dates", repo, graph);
    const lastAnchor = r.slice.map((s) => s.dist === 0).lastIndexOf(true);
    const firstNonAnchor = r.slice.findIndex((s) => s.dist !== 0);
    expect(lastAnchor).toBeGreaterThanOrEqual(0);
    expect(firstNonAnchor).toBeGreaterThan(lastAnchor);
  });

  it("anchors the implementation a matched test file covers", () => {
    // Tests are written in behavioural prose and therefore match task language
    // better than the code they cover. Without pairing, a task can anchor on
    // four test files and leave the implementation outside the Anchor cap.
    const paired: RepoData = {
      name: "paired",
      slug: "paired",
      description: "",
      root: "",
      recentlyChanged: [],
      files: {
        "src/lib/pricing.ts":
          'import { rate } from "./rate";\n'
          + "export function computeDiscount(plan) { return rate(plan); }\n"
          + "export function applyDiscount() {}",
        "src/lib/pricing.test.ts":
          'import { computeDiscount } from "./pricing";\n'
          + "// computeDiscount returns the wrong discount for annual plans\n"
          + 'describe("pricing discount", () => {\n'
          + '  it("computes the annual discount", () => { computeDiscount(); });\n'
          + "});",
        "src/lib/rate.ts": "export function rate() { return 1; }",
        "src/app/checkout/page.tsx": "export default function Checkout() { return null; }",
        "src/lib/unrelated.ts": "export const unrelated = 1;",
      },
    };
    const pairedGraph = buildGraph(paired);
    const result = locate("pricing discount returns the wrong amount", paired, pairedGraph);

    // Verified non-vacuous: with the pairing removed, this same input anchors on
    // the test file alone and the implementation is left at closure distance.
    expect(result.anchorPaths).toContain("src/lib/pricing.test.ts");
    expect(result.anchorPaths).toContain("src/lib/pricing.ts");
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

describe("Python repositories", () => {
  // Python is the largest language in agent tooling and was entirely
  // unsupported: a Python repository loaded as zero files and Locus refused it.
  const python: RepoData = {
    name: "pyshop",
    slug: "pyshop",
    description: "",
    root: "",
    recentlyChanged: [],
    files: {
      "app/api/checkout.py":
        "from app.services.billing import charge_card\n"
        + "from app.models.order import Order\n"
        + "from .schemas import CheckoutRequest\n"
        + "import stripe\n\n"
        + "def post_checkout(req):\n    return charge_card(Order.create(req).total)\n",
      "app/api/schemas.py": "class CheckoutRequest:\n    items: list\n",
      "app/services/billing.py":
        "from ..models.order import Order\n\ndef charge_card(total):\n    return total\n",
      "app/models/order.py": "class Order:\n    pass\n",
      "app/models/__init__.py": "",
      "app/services/reporting.py": "from app.models.order import Order\n\ndef monthly():\n    return []\n",
    },
  };
  const graph = buildGraph(python);

  it("builds nodes for .py files", () => {
    expect(graph.nodes.map((n) => n.rel).sort()).toContain("app/api/checkout.py");
  });

  it("follows an absolute dotted import to the module it names", () => {
    expect(graph.deps["app/api/checkout.py"]).toContain("app/services/billing.py");
    expect(graph.deps["app/api/checkout.py"]).toContain("app/models/order.py");
  });

  it("follows a single-dot relative import to a sibling", () => {
    expect(graph.deps["app/api/checkout.py"]).toContain("app/api/schemas.py");
  });

  it("follows a double-dot relative import one package up", () => {
    expect(graph.deps["app/services/billing.py"]).toContain("app/models/order.py");
  });

  it("does not make a third-party package an edge", () => {
    // `import stripe` resolves to nothing in the Repo, exactly as a bare
    // JavaScript specifier already did.
    expect(graph.deps["app/api/checkout.py"]).not.toContain("stripe");
    expect(graph.deps["app/api/checkout.py"].every((d) => d.endsWith(".py"))).toBe(true);
  });

  it("localizes a Python task to its closure and excludes the rest", () => {
    const result = locate("the checkout charges the wrong amount", python, graph);
    const rels = result.slice.map((f) => f.rel);

    expect(result.widened).toBe(false);
    expect(rels).toContain("app/api/checkout.py");
    expect(rels).toContain("app/services/billing.py");
    // Reporting shares the Order model but has nothing to do with checkout.
    expect(rels).not.toContain("app/services/reporting.py");
  });

  it("gives Python files no Surface, because Python routing cannot be detected", () => {
    // CONTEXT.md requires Surfaces be discovered structurally. Python frameworks
    // route through decorators and registries, so guessing would break that.
    expect(graph.nodes.filter((n) => n.rel.endsWith(".py")).every((n) => !n.isSurface)).toBe(true);
  });
});

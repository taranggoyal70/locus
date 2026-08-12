import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it, vi } from "vitest";

import { ExcludedFileList, FilePanel } from "@/components/FilePanel";
import type { LocateResult, RepoData } from "@/lib/types";

const result: LocateResult = {
  task: "fix the dashboard chart",
  widened: false,
  reason: "matched dashboard",
  anchors: ["app/dashboard/page.tsx"],
  anchorPaths: ["src/app/dashboard/page.tsx"],
  slice: [
    {
      path: "src/app/dashboard/page.tsx",
      rel: "app/dashboard/page.tsx",
      dist: 0,
      tokens: 42,
      recent: false,
    },
  ],
  excluded: [
    "app/reports/page.tsx",
    "components/CohortTable.tsx",
    "lib/reporting.ts",
  ],
  excludedPaths: [
    "src/app/reports/page.tsx",
    "src/components/CohortTable.tsx",
    "src/lib/reporting.ts",
  ],
  sliceTokens: 42,
  totalTokens: 160,
  savedPct: 74,
  refinement: null,
};

const repo: RepoData = {
  name: "fixture",
  slug: "fixture",
  description: "",
  root: "src",
  recentlyChanged: [],
  files: {
    "src/app/dashboard/page.tsx": "export default function Dashboard() {}",
    "src/app/reports/page.tsx": "export default function Reports() {}",
    "src/components/CohortTable.tsx": "export function CohortTable() {}",
    "src/lib/reporting.ts": "export const reporting = true;",
  },
};

describe("FilePanel", () => {
  it("makes the excluded set a first-class view with an exact count", () => {
    const html = renderToStaticMarkup(
      <FilePanel
        result={result}
        repo={repo}
        selected={null}
        onSelect={vi.fn()}
      />,
    );

    expect(html).toContain("Included");
    expect(html).toContain("Excluded");
    expect(html).toContain(">3<");
    expect(html).toContain('role="group"');
    expect(html).not.toContain('role="tab"');
  });

  it("renders every excluded path without truncating the audit list", () => {
    const html = renderToStaticMarkup(
      <ExcludedFileList files={result.excluded} onSelect={vi.fn()} />,
    );

    for (const path of result.excluded) {
      expect(html).toContain(path);
    }
    expect(html).not.toContain("truncate");
    expect(html).toContain("break-all");
  });
});

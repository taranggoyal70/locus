import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { RepositoryLoadFeedback } from "@/components/RepositoryLoadFeedback";

describe("repository load recovery", () => {
  it("keeps the active Slice visible and offers recovery for a temporary failure", () => {
    const html = renderToStaticMarkup(
      <RepositoryLoadFeedback
        issue={{
          message: "Repository requests are temporarily unavailable.",
          code: "temporary",
          retryable: true,
          attemptedRepository: "owner/repo",
        }}
        activeRepoName="Taxonomy"
        onRetry={vi.fn()}
        onUseDemo={vi.fn()}
      />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain("Taxonomy is still open");
    expect(html).toContain(">Retry</button>");
    expect(html).toContain("Open demo Repo");
  });

  it("explains the public-Repo boundary without offering a futile retry", () => {
    const html = renderToStaticMarkup(
      <RepositoryLoadFeedback
        issue={{
          message: "Repo not found.",
          code: "unavailable",
          retryable: false,
          attemptedRepository: "owner/private",
        }}
        activeRepoName={null}
        onRetry={vi.fn()}
        onUseDemo={vi.fn()}
      />,
    );

    expect(html).toContain("Public GitHub Repos only during the controlled alpha");
    expect(html).not.toContain(">Retry</button>");
    expect(html).toContain("Open demo Repo");
  });
});
